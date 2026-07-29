/**
 * Apertura fiable de apps y sitios web en Windows
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

/** Sitios web conocidos → URL (NUNCA como .exe) */
const WEB_SITES = {
  youtube: 'https://www.youtube.com',
  yt: 'https://www.youtube.com',
  google: 'https://www.google.com',
  gmail: 'https://mail.google.com',
  maps: 'https://maps.google.com',
  drive: 'https://drive.google.com',
  docs: 'https://docs.google.com',
  facebook: 'https://www.facebook.com',
  instagram: 'https://www.instagram.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
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

function normalizeName(appName) {
  return (appName || '')
    .toLowerCase()
    .trim()
    .replace(/^el\s+|^la\s+|^los\s+|^las\s+/, '')
    .replace(/\s+/g, ' ');
}

/** Si es un sitio web conocido, devolver URL */
function resolveWebUrl(appName) {
  const name = normalizeName(appName);
  // URL directa
  if (/^https?:\/\//i.test(name)) return name;
  if (/^[\w-]+\.(com|org|net|es|io|app)\b/i.test(name)) return 'https://' + name;
  // mapa
  for (const [key, url] of Object.entries(WEB_SITES)) {
    if (name === key || name.includes(key)) return url;
  }
  return null;
}

function resolveApp(appName) {
  const name = normalizeName(appName);

  if (/\b(word|winword|microsoft word)\b/.test(name) || name === 'word') {
    const exe = findOfficeExe('WINWORD.EXE');
    return { label: 'Word', targets: [exe, 'winword', 'WINWORD.EXE'].filter(Boolean), psName: 'WINWORD' };
  }
  if (/\b(excel)\b/.test(name)) {
    const exe = findOfficeExe('EXCEL.EXE');
    return { label: 'Excel', targets: [exe, 'excel', 'EXCEL.EXE'].filter(Boolean), psName: 'EXCEL' };
  }
  if (/\b(powerpoint|power point)\b/.test(name)) {
    const exe = findOfficeExe('POWERPNT.EXE');
    return { label: 'PowerPoint', targets: [exe, 'powerpnt'].filter(Boolean), psName: 'POWERPNT' };
  }
  if (/\b(outlook)\b/.test(name)) {
    const exe = findOfficeExe('OUTLOOK.EXE');
    return { label: 'Outlook', targets: [exe, 'outlook'].filter(Boolean), psName: 'OUTLOOK' };
  }
  if (/\b(chrome|google chrome)\b/.test(name)) {
    const chrome = findInLocal([path.join('Google', 'Chrome', 'Application', 'chrome.exe')]) || 'chrome';
    return { label: 'Chrome', targets: [chrome, 'chrome'].filter(Boolean), psName: 'chrome' };
  }
  if (/\b(edge|microsoft edge)\b/.test(name)) {
    return { label: 'Edge', targets: ['msedge'], psName: 'msedge' };
  }
  if (/\b(firefox)\b/.test(name)) {
    return { label: 'Firefox', targets: ['firefox'], psName: 'firefox' };
  }
  if (/\b(notepad|bloc de notas|bloc)\b/.test(name)) {
    return { label: 'Bloc de notas', targets: ['notepad.exe', 'notepad'], psName: 'notepad' };
  }
  if (/\b(calculadora|calculator|calc)\b/.test(name)) {
    return { label: 'Calculadora', targets: ['calc.exe'], psName: 'Calculator' };
  }
  if (/\b(paint)\b/.test(name)) {
    return { label: 'Paint', targets: ['mspaint.exe'], psName: 'mspaint' };
  }
  if (/\b(explorer|explorador)\b/.test(name)) {
    return { label: 'Explorador', targets: ['explorer.exe'], psName: 'explorer' };
  }
  if (/\b(cmd|terminal|consola)\b/.test(name)) {
    return { label: 'Terminal', targets: ['cmd.exe', 'wt.exe'], psName: 'cmd' };
  }
  if (/\b(code|vscode|visual studio code)\b/.test(name)) {
    const code = findInLocal([
      path.join('Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join('Microsoft VS Code', 'Code.exe'),
    ]);
    return { label: 'VS Code', targets: [code, 'code'].filter(Boolean), psName: 'Code' };
  }
  if (/\b(spotify)\b/.test(name)) {
    return { label: 'Spotify', targets: ['spotify'], psName: 'Spotify' };
  }
  if (/\b(discord)\b/.test(name)) {
    return { label: 'Discord', targets: ['discord'], psName: 'Discord' };
  }

  return { label: appName, targets: [name], psName: name };
}

async function tryStartWindows(target) {
  if (target.includes('\\') || target.includes('/') || /^[A-Za-z]:/.test(target)) {
    if (fs.existsSync(target)) {
      const err = await shell.openPath(target);
      if (!err) return true;
      spawn(target, [], { detached: true, stdio: 'ignore', shell: false }).unref();
      return true;
    }
  }
  try {
    await execAsync(`cmd /c start "" "${target}"`, { windowsHide: true, timeout: 8000 });
    return true;
  } catch {}
  try {
    await execAsync(
      `powershell -NoProfile -Command "Start-Process -FilePath '${String(target).replace(/'/g, "''")}'"`,
      { windowsHide: true, timeout: 10000 },
    );
    return true;
  } catch {}
  try {
    const { stdout } = await execAsync(`where ${target}`, { windowsHide: true, timeout: 5000 });
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
    if (!u) return { ok: false, result: 'URL vacía', message: 'No hay enlace' };
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    await shell.openExternal(u);
    return { ok: true, result: 'URL abierta', message: `Abrí ${u.replace(/^https?:\/\//, '').split('/')[0]}` };
  } catch (e) {
    return { ok: false, result: e.message, message: 'No pude abrir el enlace' };
  }
}

async function openApp(appName) {
  // 1) Sitios web primero
  const webUrl = resolveWebUrl(appName);
  if (webUrl) {
    return openUrl(webUrl);
  }

  const resolved = resolveApp(appName);

  if (process.platform === 'win32') {
    for (const t of resolved.targets) {
      try {
        if (await tryStartWindows(t)) {
          return {
            ok: true,
            result: `${resolved.label} abierto`,
            message: `Listo, abrí ${resolved.label}.`,
          };
        }
      } catch {}
    }
    return {
      ok: false,
      result: 'not found',
      message: `No pude abrir ${resolved.label}. ¿Está instalado en este PC?`,
    };
  }

  try {
    if (process.platform === 'darwin') {
      await execAsync(`open -a "${resolved.targets[0] || appName}"`);
    } else {
      spawn(resolved.targets[0] || appName, [], { detached: true, stdio: 'ignore' }).unref();
    }
    return { ok: true, result: 'Abierto', message: `Abriendo ${resolved.label}` };
  } catch (err) {
    return { ok: false, result: err.message, message: `No pude abrir ${resolved.label}` };
  }
}

module.exports = { openApp, openUrl, resolveApp, resolveWebUrl, WEB_SITES };
