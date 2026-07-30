/**
 * Apertura fiable de apps y sitios web — ELYRA v3.2
 */
const path = require('path');
const fs = require('fs');
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
  outlook_web: 'https://outlook.live.com',
  calendar: 'https://calendar.google.com',
  meet: 'https://meet.google.com',
  zoom: 'https://zoom.us',
  weather: 'https://www.google.com/search?q=clima',
  clima: 'https://www.google.com/search?q=clima',
  claude: 'https://claude.ai',
  perplexity: 'https://www.perplexity.ai',
};

// Alias cortos: SOLO coincidencia exacta (evita python ⊃ yt → YouTube)
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

function fixTypos(s) {
  return String(s || '')
    .replace(/\bcrhome\b/gi, 'chrome')
    .replace(/\bcrom\b/gi, 'chrome')
    .replace(/\bgrome\b/gi, 'chrome')
    .replace(/\bchroem\b/gi, 'chrome')
    .replace(/\bchorme\b/gi, 'chrome')
    .replace(/\byoutub\b/gi, 'youtube')
    .replace(/\bgogle\b/gi, 'google')
    .replace(/\bgoogel\b/gi, 'google');
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

/** Coincidencia por palabra completa, no substring (python ≠ yt) */
function wordIn(hay, needle) {
  const re = new RegExp('\\b' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  return re.test(hay);
}

function resolveWebUrl(appName) {
  const name = normalizeName(appName);
  if (!name) return null;
  if (/^https?:\/\//i.test(name)) return name;
  if (/^[\w-]+\.(com|org|net|es|io|app)\b/i.test(name)) return 'https://' + name;

  // Alias exactos cortos
  if (WEB_ALIASES_EXACT[name]) return WEB_ALIASES_EXACT[name];

  // Solo si el nombre ES el sitio o lo contiene como palabra completa
  for (const [key, url] of Object.entries(WEB_SITES)) {
    if (name === key || wordIn(name, key)) return url;
  }
  return null;
}

function resolveApp(appName) {
  const name = normalizeName(appName);

  if (/\b(word|winword|microsoft word)\b/.test(name) || name === 'word') {
    const exe = findOfficeExe('WINWORD.EXE');
    return { label: 'Word', targets: [exe, 'winword', 'WINWORD.EXE'].filter(Boolean), psName: 'WINWORD', key: 'word' };
  }
  if (/\b(excel)\b/.test(name)) {
    const exe = findOfficeExe('EXCEL.EXE');
    return { label: 'Excel', targets: [exe, 'excel', 'EXCEL.EXE'].filter(Boolean), psName: 'EXCEL', key: 'excel' };
  }
  if (/\b(powerpoint|power point)\b/.test(name)) {
    const exe = findOfficeExe('POWERPNT.EXE');
    return { label: 'PowerPoint', targets: [exe, 'powerpnt'].filter(Boolean), psName: 'POWERPNT', key: 'powerpoint' };
  }
  if (/\b(outlook)\b/.test(name)) {
    const exe = findOfficeExe('OUTLOOK.EXE');
    return { label: 'Outlook', targets: [exe, 'outlook'].filter(Boolean), psName: 'OUTLOOK', key: 'outlook' };
  }
  if (/\b(chrome|google chrome)\b/.test(name) || name === 'chrome') {
    const chrome = findInLocal([path.join('Google', 'Chrome', 'Application', 'chrome.exe')]) || 'chrome';
    return { label: 'Chrome', targets: [chrome, 'chrome'].filter(Boolean), psName: 'chrome', key: 'chrome' };
  }
  if (/\b(edge|microsoft edge)\b/.test(name)) {
    return { label: 'Edge', targets: ['msedge'], psName: 'msedge', key: 'edge' };
  }
  if (/\b(firefox)\b/.test(name)) {
    return { label: 'Firefox', targets: ['firefox'], psName: 'firefox', key: 'firefox' };
  }
  if (/\b(notepad|bloc de notas|bloc)\b/.test(name)) {
    return { label: 'Bloc de notas', targets: ['notepad.exe', 'notepad'], psName: 'notepad', key: 'notepad' };
  }
  if (/\b(calculadora|calculator|calc)\b/.test(name)) {
    return { label: 'Calculadora', targets: ['calc.exe'], psName: 'Calculator', key: 'calc' };
  }
  if (/\b(paint)\b/.test(name)) {
    return { label: 'Paint', targets: ['mspaint.exe'], psName: 'mspaint', key: 'paint' };
  }
  if (/\b(explorer|explorador)\b/.test(name)) {
    return { label: 'Explorador', targets: ['explorer.exe'], psName: 'explorer', key: 'explorer' };
  }
  if (/\b(cmd|terminal|consola|powershell)\b/.test(name)) {
    return { label: 'Terminal', targets: ['wt.exe', 'powershell.exe', 'cmd.exe'], psName: 'WindowsTerminal', key: 'terminal' };
  }
  if (/\b(code|vscode|visual studio code)\b/.test(name)) {
    const code = findInLocal([
      path.join('Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join('Microsoft VS Code', 'Code.exe'),
    ]);
    return { label: 'VS Code', targets: [code, 'code'].filter(Boolean), psName: 'Code', key: 'code' };
  }
  if (/\b(spotify)\b/.test(name)) {
    const local = findInLocal([
      path.join('Microsoft', 'WindowsApps', 'Spotify.exe'),
      path.join('Programs', 'Spotify', 'Spotify.exe'),
      path.join('Spotify', 'Spotify.exe'),
    ]);
    return {
      label: 'Spotify',
      targets: [local, 'spotify:', 'spotify'].filter(Boolean),
      psName: 'Spotify',
      key: 'spotify',
    };
  }
  if (/\b(discord)\b/.test(name)) {
    return { label: 'Discord', targets: ['discord'], psName: 'Discord', key: 'discord' };
  }
  if (/\b(teams|microsoft teams)\b/.test(name)) {
    return { label: 'Teams', targets: ['ms-teams:', 'teams'], psName: 'Teams', key: 'teams' };
  }
  if (/\b(slack)\b/.test(name)) {
    return { label: 'Slack', targets: ['slack'], psName: 'slack', key: 'slack' };
  }
  if (/\b(steam)\b/.test(name)) {
    return { label: 'Steam', targets: ['steam'], psName: 'steam', key: 'steam' };
  }
  if (/\b(task manager|administrador de tareas)\b/.test(name)) {
    return { label: 'Administrador de tareas', targets: ['taskmgr.exe'], psName: 'Taskmgr', key: 'taskmgr' };
  }
  if (/\b(control panel|panel de control)\b/.test(name)) {
    return { label: 'Panel de control', targets: ['control.exe'], psName: 'control', key: 'control' };
  }
  if (/\b(snipping|recorte)\b/.test(name)) {
    return { label: 'Recortes', targets: ['SnippingTool.exe', 'ms-screenclip:'], psName: 'SnippingTool', key: 'snipping' };
  }

  return { label: appName, targets: [name], psName: name, key: name };
}

async function tryStartWindows(target) {
  if (!target) return false;
  if (target.includes('\\') || target.includes('/') || /^[A-Za-z]:/.test(target)) {
    if (fs.existsSync(target)) {
      const err = await shell.openPath(target);
      if (!err) return true;
      try {
        spawn(target, [], { detached: true, stdio: 'ignore', shell: false }).unref();
        return true;
      } catch {}
    }
  }
  if (/^[a-z][\w+-]*:/i.test(target)) {
    try {
      await shell.openExternal(target);
      return true;
    } catch {}
  }
  try {
    await execAsync('cmd /c start "" "' + target + '"', { windowsHide: true, timeout: 8000 });
    return true;
  } catch {}
  try {
    await execAsync(
      "powershell -NoProfile -Command \"Start-Process -FilePath '" +
        String(target).replace(/'/g, "''") +
        "'\"",
      { windowsHide: true, timeout: 10000 },
    );
    return true;
  } catch {}
  try {
    const { stdout } = await execAsync('where ' + target, { windowsHide: true, timeout: 5000 });
    const first = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.toLowerCase().endsWith('.exe'));
    if (first && fs.existsSync(first)) {
      const err = await shell.openPath(first);
      if (!err) return true;
    }
  } catch {}
  return false;
}

async function openUrl(url) {
  try {
    let u = (url || '').trim();
    if (!u) return { ok: false, result: 'URL vacia', message: 'No hay enlace' };
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
  if (wantsWeb(appName)) {
    const web = resolveWebUrl(appName) || APP_WEB_FALLBACK[normalizeName(appName)];
    if (web) return openUrl(web);
  }

  const webUrl = resolveWebUrl(appName);
  const resolved = resolveApp(appName);
  const preferAppFirst = ['spotify', 'discord', 'slack', 'teams', 'steam', 'chrome', 'edge', 'firefox', 'word', 'excel'].includes(
    resolved.key,
  );

  // Sitios web puros (youtube, google…) — no confundir con frases largas
  if (webUrl && !preferAppFirst && normalizeName(appName).split(/\s+/).length <= 3) {
    return openUrl(webUrl);
  }

  if (process.platform === 'win32') {
    for (const t of resolved.targets) {
      try {
        if (await tryStartWindows(t)) {
          return {
            ok: true,
            result: resolved.label + ' abierto',
            message: 'Listo, abrí ' + resolved.label + '.',
          };
        }
      } catch {}
    }
    const fb = APP_WEB_FALLBACK[resolved.key] || webUrl;
    if (fb) {
      const r = await openUrl(fb);
      if (r.ok) {
        return {
          ok: true,
          result: 'web',
          message: 'No encontré la app de ' + resolved.label + '. Abrí la versión web.',
        };
      }
    }
    return {
      ok: false,
      result: 'not found',
      message: 'No pude abrir ' + resolved.label + '. ¿Está instalado o quieres la versión web?',
    };
  }

  try {
    if (process.platform === 'darwin') {
      await execAsync('open -a "' + (resolved.targets[0] || appName) + '"');
    } else {
      spawn(resolved.targets[0] || appName, [], { detached: true, stdio: 'ignore' }).unref();
    }
    return { ok: true, result: 'Abierto', message: 'Abriendo ' + resolved.label };
  } catch (err) {
    const fb = APP_WEB_FALLBACK[resolved.key] || webUrl;
    if (fb) return openUrl(fb);
    return { ok: false, result: err.message, message: 'No pude abrir ' + resolved.label };
  }
}

module.exports = { openApp, openUrl, resolveApp, resolveWebUrl, WEB_SITES, APP_WEB_FALLBACK, fixTypos, normalizeName };
