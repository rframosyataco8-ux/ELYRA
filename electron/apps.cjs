/**
 * Apertura fiable de aplicaciones en Windows / macOS / Linux
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
  ['Microsoft Office', 'Office14'],
];

function findOfficeExe(exeName) {
  for (const root of OFFICE_ROOTS) {
    for (const rel of OFFICE_REL) {
      const full = path.join(root, ...rel, exeName);
      if (fs.existsSync(full)) return full;
    }
    // Office Click-to-Run genérico
    const c2r = path.join(root, 'Microsoft Office', 'root', 'Office16', exeName);
    if (fs.existsSync(c2r)) return c2r;
  }
  return null;
}

function findInLocal(names) {
  const local = process.env.LOCALAPPDATA || '';
  const pf = process.env.ProgramFiles || '';
  const pf86 = process.env['ProgramFiles(x86)'] || '';
  const candidates = [];
  for (const base of [local, pf, pf86]) {
    for (const n of names) {
      candidates.push(path.join(base, n));
    }
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

/** Mapa de nombres hablados → estrategias de lanzamiento */
function resolveApp(appName) {
  const name = (appName || '').toLowerCase().trim()
    .replace(/^el\s+|^la\s+|^los\s+|^las\s+/, '')
    .replace(/\s+/g, ' ');

  // Word
  if (/\b(word|winword|microsoft word)\b/.test(name) || name === 'word') {
    const exe = findOfficeExe('WINWORD.EXE');
    return {
      label: 'Word',
      targets: [exe, 'winword', 'WINWORD.EXE', 'winword.exe'].filter(Boolean),
      psName: 'WINWORD',
    };
  }
  if (/\b(excel)\b/.test(name)) {
    const exe = findOfficeExe('EXCEL.EXE');
    return { label: 'Excel', targets: [exe, 'excel', 'EXCEL.EXE'].filter(Boolean), psName: 'EXCEL' };
  }
  if (/\b(powerpoint|power point)\b/.test(name)) {
    const exe = findOfficeExe('POWERPNT.EXE');
    return { label: 'PowerPoint', targets: [exe, 'powerpnt', 'POWERPNT.EXE'].filter(Boolean), psName: 'POWERPNT' };
  }
  if (/\b(outlook)\b/.test(name)) {
    const exe = findOfficeExe('OUTLOOK.EXE');
    return { label: 'Outlook', targets: [exe, 'outlook', 'OUTLOOK.EXE'].filter(Boolean), psName: 'OUTLOOK' };
  }

  if (/\b(chrome|google chrome)\b/.test(name)) {
    const chrome =
      findInLocal([
        path.join('Google', 'Chrome', 'Application', 'chrome.exe'),
      ]) ||
      'chrome';
    return { label: 'Chrome', targets: [chrome, 'chrome', 'google-chrome'].filter(Boolean), psName: 'chrome' };
  }
  if (/\b(edge|microsoft edge)\b/.test(name)) {
    return { label: 'Edge', targets: ['msedge', 'microsoft-edge'], psName: 'msedge' };
  }
  if (/\b(firefox)\b/.test(name)) {
    return { label: 'Firefox', targets: ['firefox'], psName: 'firefox' };
  }
  if (/\b(notepad|bloc de notas)\b/.test(name)) {
    return { label: 'Bloc de notas', targets: ['notepad.exe', 'notepad'], psName: 'notepad' };
  }
  if (/\b(calculadora|calculator|calc)\b/.test(name)) {
    return { label: 'Calculadora', targets: ['calc.exe', 'calculator:'], psName: 'Calculator' };
  }
  if (/\b(paint)\b/.test(name)) {
    return { label: 'Paint', targets: ['mspaint.exe', 'mspaint'], psName: 'mspaint' };
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
    return { label: 'VS Code', targets: [code, 'code', 'Code.exe'].filter(Boolean), psName: 'Code' };
  }
  if (/\b(spotify)\b/.test(name)) {
    const sp = findInLocal([path.join('Microsoft', 'WindowsApps', 'Spotify.exe')]);
    return { label: 'Spotify', targets: [sp, 'spotify'].filter(Boolean), psName: 'Spotify' };
  }
  if (/\b(discord)\b/.test(name)) {
    const d = findInLocal([path.join('Discord', 'Update.exe')]);
    return { label: 'Discord', targets: [d, 'discord'].filter(Boolean), psName: 'Discord' };
  }

  // Genérico: usar el nombre tal cual
  return { label: appName, targets: [name], psName: name };
}

async function tryStartWindows(target) {
  // 1) Ruta absoluta existente
  if (target.includes('\\') || target.includes('/') || /^[A-Za-z]:/.test(target)) {
    if (fs.existsSync(target)) {
      const err = await shell.openPath(target);
      if (!err) return true;
      spawn(target, [], { detached: true, stdio: 'ignore', shell: false }).unref();
      return true;
    }
  }

  // 2) start de cmd (resuelve PATH y App Paths del registro)
  try {
    await execAsync(`cmd /c start "" "${target}"`, { windowsHide: true, timeout: 8000 });
    return true;
  } catch {}

  // 3) PowerShell Start-Process
  try {
    await execAsync(
      `powershell -NoProfile -Command "Start-Process -FilePath '${target.replace(/'/g, "''")}'"`,
      { windowsHide: true, timeout: 10000 },
    );
    return true;
  } catch {}

  // 4) where + ejecutar
  try {
    const { stdout } = await execAsync(`where ${target}`, { windowsHide: true, timeout: 5000 });
    const first = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s.endsWith('.exe'));
    if (first && fs.existsSync(first)) {
      const err = await shell.openPath(first);
      if (!err) return true;
      spawn(first, [], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
  } catch {}

  return false;
}

async function openApp(appName) {
  const resolved = resolveApp(appName);

  if (process.platform === 'win32') {
    for (const t of resolved.targets) {
      try {
        const ok = await tryStartWindows(t);
        if (ok) {
          return {
            ok: true,
            result: `${resolved.label} abierto`,
            message: `Listo, abrí ${resolved.label}.`,
          };
        }
      } catch {}
    }

    // Último intento: protocolo / shell
    try {
      await execAsync(`cmd /c start ${resolved.psName}`, { windowsHide: true, timeout: 8000 });
      return {
        ok: true,
        result: `${resolved.label} lanzado`,
        message: `Intenté abrir ${resolved.label}. Si no aparece, instálalo o revisa el acceso directo.`,
      };
    } catch (e) {
      return {
        ok: false,
        result: e.message,
        message: `No pude abrir ${resolved.label}. ¿Está instalado en este PC?`,
      };
    }
  }

  // macOS / Linux
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

module.exports = { openApp, resolveApp };
