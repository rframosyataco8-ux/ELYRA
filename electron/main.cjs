const { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { synthesizeToBase64, checkEdgeTts, VOICE } = require('./tts.cjs');
const { runAgent, getConfig, saveConfig, fallbackResponse, ensureDefaultConfig, normalizeUserIntent } = require('./agent.cjs');
const { runPythonStt } = require('./stt-python-ipc.cjs');
const { openApp: openAppReliable } = require('./apps.cjs');
const pc = require('./pc-control.cjs');
const { transcribeBuffer } = require('./stt.cjs');

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
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('ELYRA');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Mostrar',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

async function openAppHelper(name) {
  return openAppReliable(name);
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
      musica: path.join(home, 'Music'),
      videos: path.join(home, 'Videos'),
      informes: path.join(home, 'Documents', 'Informes'),
    };
    const key = (folder || '').toLowerCase();
    let target = map[key] || folder;
    if (key === 'informes' && !fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    const err = await shell.openPath(target);
    if (err) return { ok: false, result: err, message: 'No pude abrir la carpeta' };
    return { ok: true, result: `Abriendo ${folder}`, message: `Abrí la carpeta ${folder}` };
  } catch (err) {
    return { ok: false, result: err.message, message: String(err) };
  }
}

async function openUrlHelper(url) {
  try {
    let u = (url || '').trim();
    if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
    await shell.openExternal(u);
    return { ok: true, result: 'URL abierta' };
  } catch (err) {
    return { ok: false, result: String(err) };
  }
}

async function runCommandHelper(command) {
  try {
    const blocked = [/rm\s+-rf\s+\//, /format\s+/i, /del\s+\/s/i, /shutdown/i, /mkfs/i];
    if (blocked.some((re) => re.test(command))) return { ok: false, result: 'Comando bloqueado.' };
    const { stdout, stderr } = await execAsync(command, {
      timeout: 20000,
      maxBuffer: 512 * 1024,
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
  return { ok: true, result: 'Guardado en memoria' };
}
async function recallHelper() {
  const mem = readMemory();
  const notes = (mem.notes || []).slice(-20).map((n) => n.text);
  const facts = (mem.facts || []).slice(-20).map((f) => f.text);
  if (!notes.length && !facts.length) return { ok: true, result: 'Sin notas en memoria.' };
  return {
    ok: true,
    result: `Notas: ${notes.join(' | ') || 'ninguna'}. Hechos: ${facts.join(' | ') || 'ninguno'}.`,
  };
}

const agentHelpers = {
  openApp: openAppHelper,
  openFolder: openFolderHelper,
  openUrl: openUrlHelper,
  runCommand: runCommandHelper,
  remember: rememberHelper,
  recall: recallHelper,
  pc,
};

ipcMain.handle('get-system-stats', async () => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let cpuUsage = 15;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
        const match = stdout.match(/LoadPercentage=(\d+)/);
        if (match) cpuUsage = parseInt(match[1], 10);
      }
    } catch {}
    let diskUsage = 50;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(
          'wmic logicaldisk where DeviceID="C:" get FreeSpace,Size /value',
        );
        const free = parseInt((stdout.match(/FreeSpace=(\d+)/) || [])[1] || '0', 10);
        const size = parseInt((stdout.match(/Size=(\d+)/) || [])[1] || '1', 10);
        if (size > 0) diskUsage = Math.round(((size - free) / size) * 100);
      }
    } catch {}
    return {
      cpu: cpuUsage,
      ram: Math.round(((totalMem - freeMem) / totalMem) * 100),
      disk: diskUsage,
      net: Math.round(Math.random() * 20 + 5),
      platform: process.platform,
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemGB: +(totalMem / 1e9).toFixed(1),
      freeMemGB: +(freeMem / 1e9).toFixed(1),
    };
  } catch {
    return { cpu: 15, ram: 45, disk: 50, net: 10 };
  }
});

ipcMain.handle('open-app', async (_e, name) => openAppHelper(name));
ipcMain.handle('open-path', async (_e, p) => {
  const result = await shell.openPath(p);
  return result ? { ok: false, message: result } : { ok: true, message: 'Abierto' };
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
ipcMain.handle('tts-speak', async (_e, text) => {
  try {
    return { ok: true, dataUrl: await synthesizeToBase64(text) };
  } catch (err) {
    return { ok: false, error: err.message, fallback: true };
  }
});
ipcMain.handle('tts-status', () => ({ edgeTts: checkEdgeTts(), voice: VOICE }));

ipcMain.handle('pc-volume', async (_e, { action, value }) => pc.volume(action, value));
ipcMain.handle('pc-media', async (_e, { action }) => pc.media(action));
ipcMain.handle('pc-brightness', async (_e, { action, value }) => pc.brightness(action, value));
ipcMain.handle('pc-clipboard', async (_e, { action, text }) => pc.clipboard(action, text));
ipcMain.handle('pc-screenshot', async () => pc.screenshot());
ipcMain.handle('pc-list-processes', async () => pc.listProcesses());
ipcMain.handle('pc-kill-process', async (_e, name) => pc.killProcess(name));
ipcMain.handle('pc-windows', async (_e, { action }) => pc.windows(action));
ipcMain.handle('pc-input', async (_e, payload) => pc.input(payload.action, payload));

ipcMain.handle('stt-transcribe', async (_e, payload) => {
  try {
    const { base64, mimeType } = payload || {};
    if (!base64) return { ok: false, error: 'Sin audio' };
    const buffer = Buffer.from(base64, 'base64');
    return await transcribeBuffer(buffer, mimeType || 'audio/webm');
  } catch (err) {
    return { ok: false, error: err.message || 'Error de reconocimiento' };
  }
});

ipcMain.handle('stt-listen-python', async (_e, seconds) => runPythonStt(seconds || 6));

ipcMain.handle('agent-chat', async (_e, { message, history }) => {
  ensureDefaultConfig();
  const fixed = typeof normalizeUserIntent === 'function' ? normalizeUserIntent(message) : message;
  const quick = await trySimpleIntent(fixed);
  if (quick) return quick;
  const config = getConfig();
  if (!config.apiKey) return fallbackResponse(message);
  try {
    const result = await runAgent(fixed, history || [], agentHelpers);
    return { response: result.response, intelligent: true };
  } catch (err) {
    if (/429|rate limit/i.test(String(err.message))) {
      return { response: 'El servicio está saturado un momento.', intelligent: false };
    }
    return { response: 'No pude completar eso ahora.', intelligent: false };
  }
});

ipcMain.handle('agent-config-get', () => {
  const c = getConfig();
  return { hasKey: !!c.apiKey, baseUrl: c.baseUrl, model: c.model };
});
ipcMain.handle('agent-config-set', (_e, partial) => saveConfig(partial));

async function trySimpleIntent(input) {
  const text = (input || '').toLowerCase().trim();

  if (/\b(sube|subir)\s+(el\s+)?volumen\b/.test(text) || /\bvolumen\s+arriba\b/.test(text)) {
    const r = await pc.volume('up');
    return { response: r.result, intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?volumen\b/.test(text) || /\bvolumen\s+abajo\b/.test(text)) {
    const r = await pc.volume('down');
    return { response: r.result, intelligent: false };
  }
  if (/\b(silencia|mute|silencio|calla el volumen)\b/.test(text)) {
    const r = await pc.volume('mute');
    return { response: r.result, intelligent: false };
  }
  if (/\b(captura|screenshot|captura de pantalla|hazme una foto de la pantalla)\b/.test(text)) {
    const r = await pc.screenshot();
    return { response: r.result, intelligent: false };
  }
  if (/\b(bloquea|bloquear)\s+(la\s+)?(sesión|pc|pantalla|equipo)\b/.test(text)) {
    const r = await pc.windows('lock');
    return { response: r.result, intelligent: false };
  }
  if (/\b(pausa|play|reproduce|siguiente canción|siguiente pista|anterior)\b/.test(text)) {
    if (/siguiente/.test(text)) {
      const r = await pc.media('next');
      return { response: r.result, intelligent: false };
    }
    if (/anterior/.test(text)) {
      const r = await pc.media('prev');
      return { response: r.result, intelligent: false };
    }
    const r = await pc.media('play');
    return { response: r.result, intelligent: false };
  }

  const openMatch = text.match(
    /\b(?:abre|abrir|abre\s+me|abrir\s+me|lanza|ejecuta|abre\s+el|abre\s+la)\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+)/i,
  );
  if (openMatch || /\b(abre|abrir)\b/.test(text)) {
    const folderKeys = ['documentos', 'descargas', 'escritorio', 'informes', 'imagenes', 'musica', 'videos'];
    for (const f of folderKeys) {
      if (text.includes(f)) {
        const r = await openFolderHelper(f);
        return { response: r.message || r.result, intelligent: false };
      }
    }
    let name = openMatch ? openMatch[1] : '';
    name = name.replace(/\s+(por favor|please|ahora|ya)$/i, '').trim();
    if (!name) {
      for (const app of [
        'word', 'excel', 'chrome', 'edge', 'notepad', 'calculadora', 'spotify',
        'discord', 'code', 'firefox', 'paint', 'powerpoint', 'outlook',
      ]) {
        if (text.includes(app)) {
          name = app;
          break;
        }
      }
    }
    if (name) {
      const r = await openAppHelper(name);
      return { response: r.message || r.result, intelligent: false };
    }
  }

  if (/\b(qué hora|que hora|hora es)\b/.test(text)) {
    return {
      response: `Son las ${new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })}.`,
      intelligent: false,
    };
  }
  if (/\b(qué día|que dia|fecha de hoy|qué fecha)\b/.test(text)) {
    return {
      response: `Hoy es ${new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`,
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
  ensureDefaultConfig();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'microphone', 'audioCapture'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    ['media', 'microphone', 'audioCapture'].includes(permission),
  );

  createWindow();
  createTray();

  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Space', () => {
    mainWindow?.webContents.send('elyra-barge-in');
  });
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
