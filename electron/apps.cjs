/**
 * Apertura inteligente de apps / sitios / sistema — ELYRA v4
 * Sin diálogos de error de Windows; descubrimiento vía Start Menu.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const { shell } = require('electron');
const execAsync = promisify(exec);

const OFFICE_ROOTS = [
  process.env['ProgramFiles'],
  process.env['ProgramFiles(x86)'],
  process.env['LOCALAPPDATA'],
].filter(Boolean);

const OFFICE_REL = [
  ['Microsoft Office', 'root', 'Office16'],
  ['Microsoft Office', 'root', 'Office15'],
  ['Microsoft Office', 'Office16'],
  ['Microsoft Office', 'Office15'],
];

const WEB_SITES = {
  youtube: 'https://www.youtube.com',
  google: 'https://www.google.com',
  gmail: 'https://mail.google.com',
  maps: 'https://maps.google.com',
  drive: 'https://drive.google.com',
  docs: 'https://docs.google.com',
  sheets: 'https://sheets.google.com',
  facebook: 'https://www.facebook.com',
  instagram: 'https://www.instagram.com',
  twitter: 'https://x.com',
  whatsapp: 'https://web.whatsapp.com',
  netflix: 'https://www.netflix.com',
  github: 'https://github.com',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  wikipedia: 'https://es.wikipedia.org',
  amazon: 'https://www.amazon.com',
  twitch: 'https://www.twitch.tv',
  linkedin: 'https://www.linkedin.com',
  reddit: 'https://www.reddit.com',
  tiktok: 'https://www.tiktok.com',
  translate: 'https://translate.google.com',
  traductor: 'https://translate.google.com',
  canva: 'https://www.canva.com',
  notion: 'https://www.notion.so',
  spotify: 'https://open.spotify.com',
  calendar: 'https://calendar.google.com',
  meet: 'https://meet.google.com',
  zoom: 'https://zoom.us',
  clima: 'https://www.google.com/search?q=clima',
  claude: 'https://claude.ai',
  perplexity: 'https://www.perplexity.ai',
  bluestacks: 'https://www.bluestacks.com',
};

const WEB_ALIASES_EXACT = {
  yt: 'https://www.youtube.com',
  x: 'https://x.com',
};

const APP_WEB_FALLBACK = {
  spotify: 'https://open.spotify.com',
  discord: 'https://discord.com/app',
  slack: 'https://app.slack.com',
  teams: 'https://teams.microsoft.com',
  whatsapp: 'https://web.whatsapp.com',
  notion: 'https://www.notion.so',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com',
  bluestacks: 'https://www.bluestacks.com/download.html',
};

function findOfficeExe(exeName) {
  for (const root of OFFICE_ROOTS) {
    for (const rel of OFFICE_REL) {
      const full = path.join(root, ...rel, exeName);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function findInLocal(names) {
  const bases = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const base of bases) {
    for (const n of names) {
      const c = path.join(base, n);
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

/** Busca .exe por nombre parcial en Program Files / LocalAppData (profundidad limitada). */
function findExeByKeyword(keywords, maxDepth = 4) {
  const bases = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  const keys = keywords.map((k) => k.toLowerCase());
  let found = null;

  function walk(dir, depth) {
    if (found || depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found) break;
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const low = e.name.toLowerCase();
        if (/windows|system32|winsxs|node_modules|cache|temp/i.test(low)) continue;
        walk(full, depth + 1);
      } else if (e.isFile() && /\.exe$/i.test(e.name)) {
        const low = full.toLowerCase();
        if (keys.every((k) => low.includes(k) || e.name.toLowerCase().includes(k))) {
          found = full;
          return;
        }
      }
    }
  }

  for (const b of bases) walk(b, 0);
  return found;
}

function fixTypos(s) {
  return String(s || '')
    .replace(/\bcrhome\b/gi, 'chrome')
    .replace(/\bcrom\b/gi, 'chrome')
    .replace(/\bgrome\b/gi, 'chrome')
    .replace(/\byoutub\b/gi, 'youtube')
    .replace(/\bgogle\b/gi, 'google')
    .replace(/\bgoogel\b/gi, 'google')
    .replace(/\bbluestack\b/gi, 'bluestacks')
    .replace(/\bblue stacks\b/gi, 'bluestacks');
}

function normalizeName(appName) {
  return fixTypos(appName || '')
    .toLowerCase()
    .trim()
    .replace(/^el\s+|^la\s+|^los\s+|^las\s+/, '')
    .replace(/\s+en\s+(la\s+)?(web|navegador|browser|internet).*$/i, '')
    .replace(/\s+(por favor|please|ahora|ya|porfa)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wantsWeb(appName) {
  return /\ben\s+(la\s+)?(web|navegador|browser|internet)\b/i.test(appName || '');
}

function wordIn(hay, needle) {
  const re = new RegExp('\\b' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  return re.test(hay);
}

function resolveWebUrl(appName) {
  const name = normalizeName(appName);
  if (!name) return null;
  if (/^https?:\/\//i.test(name)) return name;
  if (/^[\w-]+\.(com|org|net|es|io|app)\b/i.test(name)) return 'https://' + name;
  if (WEB_ALIASES_EXACT[name]) return WEB_ALIASES_EXACT[name];
  for (const [key, url] of Object.entries(WEB_SITES)) {
    if (name === key || wordIn(name, key)) return url;
  }
  return null;
}

/** Carpetas / utilidades del sistema (no son apps de menú). */
function resolveSystemTarget(appName) {
  const name = normalizeName(appName);
  if (/\b(papelera|recycle|reciclaje|papelera de reciclaje)\b/.test(name) || name === 'papelera') {
    return {
      kind: 'shell',
      label: 'Papelera',
      // shell: protocol no siempre; explorer es fiable
      open: async () => {
        await execAsync('explorer shell:RecycleBinFolder', { windowsHide: true, timeout: 8000 });
        return true;
      },
    };
  }
  if (/\b(documentos|documents)\b/.test(name)) {
    return {
      kind: 'folder',
      label: 'Documentos',
      open: async () => {
        await shell.openPath(path.join(os.homedir(), 'Documents'));
        return true;
      },
    };
  }
  if (/\b(descargas|downloads)\b/.test(name)) {
    return {
      kind: 'folder',
      label: 'Descargas',
      open: async () => {
        await shell.openPath(path.join(os.homedir(), 'Downloads'));
        return true;
      },
    };
  }
  if (/\b(escritorio|desktop)\b/.test(name)) {
    return {
      kind: 'folder',
      label: 'Escritorio',
      open: async () => {
        await shell.openPath(path.join(os.homedir(), 'Desktop'));
        return true;
      },
    };
  }
  if (/\b(configuraci[oó]n|ajustes|settings)\b/.test(name)) {
    return {
      kind: 'uri',
      label: 'Configuración',
      open: async () => {
        await shell.openExternal('ms-settings:');
        return true;
      },
    };
  }
  return null;
}

function resolveApp(appName) {
  const name = normalizeName(appName);

  if (/\b(word|winword|microsoft word)\b/.test(name) || name === 'word') {
    const exe = findOfficeExe('WINWORD.EXE');
    return { label: 'Word', targets: [exe, 'winword'].filter(Boolean), key: 'word' };
  }
  if (/\b(excel)\b/.test(name)) {
    const exe = findOfficeExe('EXCEL.EXE');
    return { label: 'Excel', targets: [exe, 'excel'].filter(Boolean), key: 'excel' };
  }
  if (/\b(powerpoint|power point)\b/.test(name)) {
    const exe = findOfficeExe('POWERPNT.EXE');
    return { label: 'PowerPoint', targets: [exe, 'powerpnt'].filter(Boolean), key: 'powerpoint' };
  }
  if (/\b(outlook)\b/.test(name)) {
    const exe = findOfficeExe('OUTLOOK.EXE');
    return { label: 'Outlook', targets: [exe, 'outlook'].filter(Boolean), key: 'outlook' };
  }
  if (/\b(chrome|google chrome)\b/.test(name) || name === 'chrome') {
    const chrome = findInLocal([path.join('Google', 'Chrome', 'Application', 'chrome.exe')]) || 'chrome';
    return { label: 'Chrome', targets: [chrome, 'chrome'].filter(Boolean), key: 'chrome' };
  }
  if (/\b(edge|microsoft edge)\b/.test(name)) {
    return { label: 'Edge', targets: ['msedge'], key: 'edge' };
  }
  if (/\b(firefox)\b/.test(name)) {
    return { label: 'Firefox', targets: ['firefox'], key: 'firefox' };
  }
  if (/\b(notepad|bloc de notas|bloc)\b/.test(name)) {
    return { label: 'Bloc de notas', targets: ['notepad.exe'], key: 'notepad' };
  }
  if (/\b(calculadora|calculator|calc)\b/.test(name)) {
    return { label: 'Calculadora', targets: ['calc.exe'], key: 'calc' };
  }
  if (/\b(paint)\b/.test(name)) {
    return { label: 'Paint', targets: ['mspaint.exe'], key: 'paint' };
  }
  if (/\b(explorer|explorador)\b/.test(name)) {
    return { label: 'Explorador', targets: ['explorer.exe'], key: 'explorer' };
  }
  if (/\b(cmd|terminal|consola|powershell)\b/.test(name)) {
    return { label: 'Terminal', targets: ['wt.exe', 'powershell.exe', 'cmd.exe'], key: 'terminal' };
  }
  if (/\b(code|vscode|visual studio code)\b/.test(name)) {
    const code = findInLocal([
      path.join('Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join('Microsoft VS Code', 'Code.exe'),
    ]);
    return { label: 'VS Code', targets: [code, 'code'].filter(Boolean), key: 'code' };
  }
  if (/\b(spotify)\b/.test(name)) {
    const local = findInLocal([
      path.join('Programs', 'Spotify', 'Spotify.exe'),
      path.join('Spotify', 'Spotify.exe'),
    ]);
    return { label: 'Spotify', targets: [local, 'spotify:'].filter(Boolean), key: 'spotify' };
  }
  if (/\b(discord)\b/.test(name)) {
    return { label: 'Discord', targets: ['discord'], key: 'discord' };
  }
  if (/\b(teams|microsoft teams)\b/.test(name)) {
    return { label: 'Teams', targets: ['ms-teams:', 'teams'], key: 'teams' };
  }
  if (/\b(slack)\b/.test(name)) {
    return { label: 'Slack', targets: ['slack'], key: 'slack' };
  }
  if (/\b(steam)\b/.test(name)) {
    return { label: 'Steam', targets: ['steam'], key: 'steam' };
  }
  if (/\b(task manager|administrador de tareas)\b/.test(name)) {
    return { label: 'Administrador de tareas', targets: ['taskmgr.exe'], key: 'taskmgr' };
  }
  if (/\b(control panel|panel de control)\b/.test(name)) {
    return { label: 'Panel de control', targets: ['control.exe'], key: 'control' };
  }
  if (/\b(snipping|recorte)\b/.test(name)) {
    return { label: 'Recortes', targets: ['SnippingTool.exe'], key: 'snipping' };
  }

  // Lenovo Vantage (común en laptops Lenovo)
  if (/\b(lenovo\s*vantage|vantage)\b/.test(name)) {
    const exe =
      findExeByKeyword(['lenovo', 'vantage']) ||
      findInLocal([
        path.join('Lenovo', 'Vantage', 'LenovoVantageService', 'LenovoVantage.exe'),
        path.join('Lenovo', 'Lenovo Vantage', 'LenovoVantage.exe'),
        path.join('Programs', 'Lenovo', 'Vantage', 'LenovoVantage.exe'),
      ]);
    return {
      label: 'Lenovo Vantage',
      targets: [exe].filter(Boolean),
      key: 'lenovo-vantage',
      startMenuQuery: 'Lenovo Vantage',
      storeId: 'LenovoCorporation.LenovoVantage',
    };
  }

  // BlueStacks
  if (/\b(bluestacks|blue stacks)\b/.test(name)) {
    const exe =
      findExeByKeyword(['bluestacks']) ||
      findInLocal([
        path.join('BlueStacks_nxt', 'HD-Player.exe'),
        path.join('BlueStacks', 'HD-Player.exe'),
        path.join('Programs', 'BlueStacks', 'HD-Player.exe'),
      ]);
    return {
      label: 'BlueStacks',
      targets: [exe].filter(Boolean),
      key: 'bluestacks',
      startMenuQuery: 'BlueStacks',
    };
  }

  return {
    label: appName.trim() || name,
    targets: [],
    key: name,
    startMenuQuery: appName.trim() || name,
  };
}

/** Abre por ruta .exe o protocolo sin diálogos molestos. */
async function tryStartSilent(target) {
  if (!target) return false;
  // Ruta absoluta a exe
  if (target.includes('\\') || target.includes('/') || /^[A-Za-z]:/.test(target)) {
    if (fs.existsSync(target)) {
      try {
        const err = await shell.openPath(target);
        if (!err) return true;
      } catch {}
      try {
        spawn(target, [], { detached: true, stdio: 'ignore', shell: false, windowsHide: true }).unref();
        return true;
      } catch {}
    }
    return false;
  }
  // Protocolo (spotify:, ms-settings:)
  if (/^[a-z][\w+-]*:/i.test(target)) {
    try {
      await shell.openExternal(target);
      return true;
    } catch {
      return false;
    }
  }
  // Comando corto conocido (chrome, notepad) vía where + openPath — NO cmd start con espacios
  if (/^[\w.-]+$/i.test(target) && !/\s/.test(target)) {
    try {
      const { stdout } = await execAsync('where ' + target, { windowsHide: true, timeout: 4000 });
      const first = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => /\.exe$/i.test(s));
      if (first && fs.existsSync(first)) {
        const err = await shell.openPath(first);
        if (!err) return true;
      }
    } catch {}
    try {
      await execAsync(
        'powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath \'' +
          target.replace(/'/g, "''") +
          '\'"',
        { windowsHide: true, timeout: 8000 },
      );
      return true;
    } catch {}
  }
  return false;
}

/** Busca en menú Inicio / apps UWP y lanza. */
async function tryStartMenuLaunch(query) {
  if (!query || process.platform !== 'win32') return false;
  const q = String(query).replace(/'/g, "''").slice(0, 80);
  const ps =
    "$ErrorActionPreference='SilentlyContinue'; " +
    "$apps = Get-StartApps | Where-Object { $_.Name -like '*" +
    q +
    "*' }; " +
    "if (-not $apps) { exit 1 }; " +
    "$a = $apps | Select-Object -First 1; " +
    "Start-Process \"shell:AppsFolder\\$($a.AppID)\"; exit 0";
  try {
    await execAsync('powershell -NoProfile -WindowStyle Hidden -Command "' + ps.replace(/"/g, '\\"') + '"', {
      windowsHide: true,
      timeout: 12000,
    });
    return true;
  } catch {}
  // Fallback más simple
  try {
    const ps2 =
      "Get-StartApps | Where-Object { $_.Name -match '" +
      q.replace(/[.*+?^${}()|[\]\\]/g, '') +
      "' } | Select-Object -First 1 | ForEach-Object { explorer.exe (\"shell:AppsFolder\\$($_.AppID)\") }";
    await execAsync('powershell -NoProfile -WindowStyle Hidden -Command "' + ps2.replace(/"/g, '\\"') + '"', {
      windowsHide: true,
      timeout: 12000,
    });
    return true;
  } catch {}
  return false;
}

async function openUrl(url) {
  try {
    let u = (url || '').trim();
    if (!u) return { ok: false, result: 'URL vacía', message: 'No hay enlace' };
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    await shell.openExternal(u);
    return {
      ok: true,
      result: 'URL abierta',
      message: 'Abrí ' + u.replace(/^https?:\/\//, '').split('/')[0],
    };
  } catch (e) {
    return { ok: false, result: e.message, message: 'No pude abrir el enlace' };
  }
}

async function openApp(appName) {
  const raw = String(appName || '').trim();
  if (!raw) return { ok: false, result: 'vacío', message: 'No indico qué abrir.' };

  // Sistema: papelera, carpetas…
  const sys = resolveSystemTarget(raw);
  if (sys) {
    try {
      await sys.open();
      return { ok: true, result: sys.label, message: 'Listo, abrí ' + sys.label + '.' };
    } catch (e) {
      return { ok: false, result: e.message, message: 'No pude abrir ' + sys.label + '.' };
    }
  }

  // Preferencia web explícita
  if (wantsWeb(raw)) {
    const web = resolveWebUrl(raw) || APP_WEB_FALLBACK[normalizeName(raw)];
    if (web) return openUrl(web);
    // buscar en google el producto
    return openUrl('https://www.google.com/search?q=' + encodeURIComponent(normalizeName(raw)));
  }

  const webUrl = resolveWebUrl(raw);
  const resolved = resolveApp(raw);
  const preferAppFirst = [
    'spotify',
    'discord',
    'slack',
    'teams',
    'steam',
    'chrome',
    'edge',
    'firefox',
    'word',
    'excel',
    'lenovo-vantage',
    'bluestacks',
  ].includes(resolved.key);

  if (webUrl && !preferAppFirst && normalizeName(raw).split(/\s+/).length <= 3) {
    return openUrl(webUrl);
  }

  if (process.platform === 'win32') {
    for (const t of resolved.targets || []) {
      try {
        if (await tryStartSilent(t)) {
          return {
            ok: true,
            result: resolved.label + ' abierto',
            message: 'Listo, abrí ' + resolved.label + '.',
          };
        }
      } catch {}
    }

    // Descubrimiento menú Inicio / UWP (Lenovo Vantage suele ser Store app)
    const q = resolved.startMenuQuery || resolved.label;
    if (q && (await tryStartMenuLaunch(q))) {
      return {
        ok: true,
        result: resolved.label + ' abierto',
        message: 'Listo, abrí ' + resolved.label + '.',
      };
    }

    const fb = APP_WEB_FALLBACK[resolved.key] || webUrl;
    if (fb) {
      const r = await openUrl(fb);
      if (r.ok) {
        return {
          ok: true,
          result: 'web',
          message: 'No encontré la app local de ' + resolved.label + '. Abrí la versión web.',
        };
      }
    }

    return {
      ok: false,
      result: 'not found',
      message:
        'No encontré "' +
        resolved.label +
        '" instalado. Puedes decir «ábrelo en la web» o el nombre exacto del acceso directo.',
    };
  }

  try {
    if (process.platform === 'darwin') {
      await execAsync('open -a "' + (resolved.targets[0] || raw) + '"');
    } else {
      spawn(resolved.targets[0] || raw, [], { detached: true, stdio: 'ignore' }).unref();
    }
    return { ok: true, result: 'Abierto', message: 'Abriendo ' + resolved.label };
  } catch (err) {
    const fb = APP_WEB_FALLBACK[resolved.key] || webUrl;
    if (fb) return openUrl(fb);
    return { ok: false, result: err.message, message: 'No pude abrir ' + resolved.label };
  }
}

module.exports = {
  openApp,
  openUrl,
  resolveApp,
  resolveWebUrl,
  resolveSystemTarget,
  WEB_SITES,
  APP_WEB_FALLBACK,
  fixTypos,
  normalizeName,
};
