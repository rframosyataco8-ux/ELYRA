const { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { synthesizeToFile, checkEdgeTts } = require('./tts.cjs');
const { runAgent, getConfig, saveConfig, fallbackResponse } = require('./agent.cjs');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#030810',
    title: 'ELYRA',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar ELYRA',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Modo autónomo',
      type: 'checkbox',
      checked: true,
      click: (item) => mainWindow?.webContents.send('autonomous-mode', item.checked),
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip('ELYRA — Asistente Inteligente');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ── Helpers shared with agent ───────────────────────────────
async function openAppHelper(appName) {
  try {
    const name = (appName || '').toLowerCase().trim();
    const appMap = {
      notepad: 'notepad.exe',
      calculadora: 'calc.exe',
      calculator: 'calc.exe',
      paint: 'mspaint.exe',
      cmd: 'cmd.exe',
      terminal: process.platform === 'win32' ? 'wt.exe' : 'gnome-terminal',
      explorer: 'explorer.exe',
      'explorador de archivos': 'explorer.exe',
      chrome: process.platform === 'win32' ? 'chrome' : 'google-chrome',
      edge: 'msedge',
      firefox: 'firefox',
      spotify: 'spotify',
      discord: 'discord',
      code: 'code',
      vscode: 'code',
      'visual studio code': 'code',
      word: 'winword',
      excel: 'excel',
      powerpoint: 'powerpnt',
      outlook: 'outlook',
    };
    const target = appMap[name] || name;
    if (process.platform === 'win32') {
      await execAsync(`start "" "${target}"`, { shell: true });
    } else if (process.platform === 'darwin') {
      await execAsync(`open -a "${target}"`);
    } else {
      spawn(target, [], { detached: true, stdio: 'ignore' }).unref();
    }
    return { ok: true, result: `Abriendo ${appName}`, message: `Abriendo ${appName}` };
  } catch (err) {
    return { ok: false, result: err.message, message: `No pude abrir "${appName}"` };
  }
}

async function openFolderHelper(folder) {
  try {
    const home = os.homedir();
    const map = {
      documentos: path.join(home, 'Documents'),
      documents: path.join(home, 'Documents'),
      descargas: path.join(home, 'Downloads'),
      downloads: path.join(home, 'Downloads'),
      escritorio: path.join(home, 'Desktop'),
      desktop: path.join(home, 'Desktop'),
      imagenes: path.join(home, 'Pictures'),
      pictures: path.join(home, 'Pictures'),
      musica: path.join(home, 'Music'),
      music: path.join(home, 'Music'),
      videos: path.join(home, 'Videos'),
      informes: path.join(home, 'Documents', 'Informes'),
    };
    const key = (folder || '').toLowerCase();
    let target = map[key] || folder;
    if (key === 'informes' && !fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    await shell.openPath(target);
    return { ok: true, result: `Abriendo ${folder}`, message: `Abriendo carpeta ${folder}` };
  } catch (err) {
    return { ok: false, result: err.message, message: String(err) };
  }
}

async function openUrlHelper(url) {
  try {
    await shell.openExternal(url);
    return { ok: true, result: `URL abierta: ${url}` };
  } catch (err) {
    return { ok: false, result: String(err) };
  }
}

async function runCommandHelper(command) {
  try {
    const blocked = [/rm\s+-rf\s+\//, /format\s+/i, /del\s+\/s/i, /shutdown/i, /mkfs/i];
    if (blocked.some((re) => re.test(command))) {
      return { ok: false, result: 'Comando bloqueado por seguridad.' };
    }
    const { stdout, stderr } = await execAsync(command, {
      timeout: 20000,
      maxBuffer: 1024 * 512,
      shell: true,
    });
    return { ok: true, result: (stdout || stderr || 'OK').slice(0, 3000) };
  } catch (err) {
    return { ok: false, result: err.message };
  }
}

function getMemoryPath() {
  return path.join(app.getPath('userData'), 'elyra-memory.json');
}

function readMemory() {
  try {
    const p = getMemoryPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return { notes: [], facts: [], history: [] };
}

function writeMemory(data) {
  try {
    fs.writeFileSync(getMemoryPath(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

async function rememberHelper(text) {
  const mem = readMemory();
  mem.notes.push({ id: Date.now().toString(), text, at: new Date().toISOString() });
  writeMemory(mem);
  return { ok: true, result: `Guardado en memoria: ${text}` };
}

const agentHelpers = {
  openApp: openAppHelper,
  openFolder: openFolderHelper,
  openUrl: openUrlHelper,
  runCommand: runCommandHelper,
  remember: rememberHelper,
};

// ── IPC ─────────────────────────────────────────────────────
ipcMain.handle('get-system-stats', async () => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    let cpuUsage = 0;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
        const match = stdout.match(/LoadPercentage=(\d+)/);
        if (match) cpuUsage = parseInt(match[1], 10);
      } else {
        const load = os.loadavg()[0];
        cpuUsage = Math.min(100, Math.round((load / cpus.length) * 100));
      }
    } catch {
      cpuUsage = Math.round(Math.random() * 30 + 10);
    }
    let diskUsage = 50;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk where DeviceID="C:" get FreeSpace,Size /value');
        const free = parseInt((stdout.match(/FreeSpace=(\d+)/) || [])[1] || '0', 10);
        const size = parseInt((stdout.match(/Size=(\d+)/) || [])[1] || '1', 10);
        if (size > 0) diskUsage = Math.round(((size - free) / size) * 100);
      } else {
        const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $5}'");
        diskUsage = parseInt(stdout.replace('%', '').trim(), 10) || 50;
      }
    } catch {
      diskUsage = 55;
    }
    return {
      cpu: cpuUsage,
      ram: Math.round((usedMem / totalMem) * 100),
      disk: diskUsage,
      net: Math.round(Math.random() * 25 + 5),
      platform: process.platform,
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemGB: +(totalMem / 1024 / 1024 / 1024).toFixed(1),
      freeMemGB: +(freeMem / 1024 / 1024 / 1024).toFixed(1),
    };
  } catch {
    return { cpu: 15, ram: 45, disk: 50, net: 10 };
  }
});

ipcMain.handle('open-app', async (_e, name) => openAppHelper(name));
ipcMain.handle('open-path', async (_e, p) => {
  const result = await shell.openPath(p);
  return result ? { ok: false, message: result } : { ok: true, message: `Abierto: ${p}` };
});
ipcMain.handle('open-url', async (_e, url) => openUrlHelper(url));
ipcMain.handle('open-folder', async (_e, folder) => openFolderHelper(folder));
ipcMain.handle('run-command', async (_e, cmd) => runCommandHelper(cmd));

ipcMain.handle('memory-get', () => readMemory());
ipcMain.handle('memory-add-note', (_e, note) => {
  const mem = readMemory();
  mem.notes.push({ id: Date.now().toString(), text: note, at: new Date().toISOString() });
  writeMemory(mem);
  return { ok: true };
});
ipcMain.handle('memory-add-fact', (_e, fact) => {
  const mem = readMemory();
  mem.facts.push({ id: Date.now().toString(), text: fact, at: new Date().toISOString() });
  writeMemory(mem);
  return { ok: true };
});
ipcMain.handle('memory-save-history', (_e, entry) => {
  const mem = readMemory();
  mem.history.push(entry);
  if (mem.history.length > 200) mem.history = mem.history.slice(-200);
  writeMemory(mem);
  return { ok: true };
});
ipcMain.handle('memory-clear', () => {
  writeMemory({ notes: [], facts: [], history: [] });
  return { ok: true };
});

// Natural TTS
ipcMain.handle('tts-speak', async (_e, text) => {
  try {
    const file = await synthesizeToFile(text, { rate: '+8%', pitch: '+0Hz' });
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message, fallback: true };
  }
});

ipcMain.handle('tts-status', () => ({
  edgeTts: checkEdgeTts(),
  voice: 'es-ES-ElviraNeural',
}));

// Intelligent agent
ipcMain.handle('agent-chat', async (_e, { message, history }) => {
  const config = getConfig();
  if (!config.apiKey) {
    // Try simple local patterns first for common tasks, else guide to config
    const simple = await trySimpleIntent(message);
    if (simple) return simple;
    return fallbackResponse(message);
  }
  try {
    const result = await runAgent(message, history || [], agentHelpers);
    return { response: result.response, intelligent: true };
  } catch (err) {
    return { response: `Error del modelo: ${err.message}`, intelligent: false };
  }
});

ipcMain.handle('agent-config-get', () => {
  const c = getConfig();
  return { hasKey: !!c.apiKey, baseUrl: c.baseUrl, model: c.model };
});

ipcMain.handle('agent-config-set', (_e, partial) => saveConfig(partial));

/** Quick intents without LLM for basic desktop actions */
async function trySimpleIntent(input) {
  const text = input.toLowerCase().trim();

  if (/\b(abre|abrir)\b/.test(text)) {
    const folderKeys = ['documentos', 'descargas', 'escritorio', 'imágenes', 'imagenes', 'música', 'musica', 'videos', 'informes'];
    for (const f of folderKeys) {
      if (text.includes(f)) {
        const r = await openFolderHelper(f);
        return { response: r.message || r.result, intelligent: false };
      }
    }
    const m = text.match(/(?:abre|abrir)\s+(?:la\s+|el\s+)?(.+)/);
    if (m) {
      const name = m[1].replace(/\s+(por favor|please)$/i, '').trim();
      const sites = {
        youtube: 'https://www.youtube.com',
        google: 'https://www.google.com',
        gmail: 'https://mail.google.com',
        github: 'https://github.com',
      };
      if (sites[name]) {
        await openUrlHelper(sites[name]);
        return { response: `Abriendo ${name}.`, intelligent: false };
      }
      const r = await openAppHelper(name);
      return { response: r.message || r.result, intelligent: false };
    }
  }

  if (/\b(qué hora|que hora|hora es)\b/.test(text)) {
    const now = new Date();
    return {
      response: `Son las ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`,
      intelligent: false,
    };
  }

  return null;
}

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.hide());

app.whenReady().then(() => {
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
