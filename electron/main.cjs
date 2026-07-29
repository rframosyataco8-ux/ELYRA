const { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { synthesizeToBase64, checkEdgeTts, VOICE } = require('./tts.cjs');
const { runAgent, getConfig, saveConfig, fallbackResponse, ensureDefaultConfig } = require('./agent.cjs');
const { runPythonStt } = require('./stt-python-ipc.cjs');

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
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('ELYRA');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mostrar', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Salir', click: () => { isQuitting = true; app.quit(); } },
    ]),
  );
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

async function openAppHelper(appName) {
  try {
    const name = (appName || '').toLowerCase().trim();
    const appMap = {
      notepad: 'notepad.exe', calculadora: 'calc.exe', calculator: 'calc.exe',
      paint: 'mspaint.exe', cmd: 'cmd.exe', explorer: 'explorer.exe',
      chrome: 'chrome', edge: 'msedge', firefox: 'firefox', spotify: 'spotify',
      discord: 'discord', code: 'code', vscode: 'code', word: 'winword', excel: 'excel',
    };
    const target = appMap[name] || name;
    if (process.platform === 'win32') await execAsync(`start "" "${target}"`, { shell: true });
    else if (process.platform === 'darwin') await execAsync(`open -a "${target}"`);
    else spawn(target, [], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, result: `Abriendo ${appName}`, message: `Abriendo ${appName}` };
  } catch (err) {
    return { ok: false, result: err.message, message: `No pude abrir "${appName}"` };
  }
}

async function openFolderHelper(folder) {
  try {
    const home = os.homedir();
    const map = {
      documentos: path.join(home, 'Documents'), documents: path.join(home, 'Documents'),
      descargas: path.join(home, 'Downloads'), downloads: path.join(home, 'Downloads'),
      escritorio: path.join(home, 'Desktop'), desktop: path.join(home, 'Desktop'),
      imagenes: path.join(home, 'Pictures'), musica: path.join(home, 'Music'),
      videos: path.join(home, 'Videos'), informes: path.join(home, 'Documents', 'Informes'),
    };
    const key = (folder || '').toLowerCase();
    let target = map[key] || folder;
    if (key === 'informes' && !fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    await shell.openPath(target);
    return { ok: true, result: `Abriendo ${folder}`, message: `Abriendo carpeta ${folder}` };
  } catch (err) {
    return { ok: false, result: err.message, message: String(err) };
  }
}

async function openUrlHelper(url) {
  try {
    await shell.openExternal(url);
    return { ok: true, result: 'URL abierta' };
  } catch (err) {
    return { ok: false, result: String(err) };
  }
}

async function runCommandHelper(command) {
  try {
    const blocked = [/rm\s+-rf\s+\//, /format\s+/i, /del\s+\/s/i, /shutdown/i, /mkfs/i];
    if (blocked.some((re) => re.test(command))) return { ok: false, result: 'Comando bloqueado por seguridad.' };
    const { stdout, stderr } = await execAsync(command, { timeout: 20000, maxBuffer: 1024 * 512, shell: true });
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
  if (!notes.length && !facts.length) return { ok: true, result: 'No hay notas en memoria todavía.' };
  return { ok: true, result: `Notas: ${notes.join(' | ') || 'ninguna'}. Hechos: ${facts.join(' | ') || 'ninguno'}.` };
}

const agentHelpers = {
  openApp: openAppHelper,
  openFolder: openFolderHelper,
  openUrl: openUrlHelper,
  runCommand: runCommandHelper,
  remember: rememberHelper,
  recall: recallHelper,
};

ipcMain.handle('get-system-stats', async () => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    let cpuUsage = 15;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
        const match = stdout.match(/LoadPercentage=(\d+)/);
        if (match) cpuUsage = parseInt(match[1], 10);
      } else {
        cpuUsage = Math.min(100, Math.round((os.loadavg()[0] / cpus.length) * 100));
      }
    } catch {}
    let diskUsage = 50;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk where DeviceID="C:" get FreeSpace,Size /value');
        const free = parseInt((stdout.match(/FreeSpace=(\d+)/) || [])[1] || '0', 10);
        const size = parseInt((stdout.match(/Size=(\d+)/) || [])[1] || '1', 10);
        if (size > 0) diskUsage = Math.round(((size - free) / size) * 100);
      }
    } catch {}
    return {
      cpu: cpuUsage,
      ram: Math.round((usedMem / totalMem) * 100),
      disk: diskUsage,
      net: Math.round(Math.random() * 25 + 5),
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

ipcMain.handle('stt-transcribe', async (_e, payload) => {
  try {
    const { base64, mimeType } = payload || {};
    if (!base64) return { ok: false, error: 'Sin audio' };
    ensureDefaultConfig();
    const config = getConfig();
    if (!config.apiKey) return { ok: false, error: 'Sin API key' };
    const buffer = Buffer.from(base64, 'base64');
    const ext = (mimeType || '').includes('mp4') ? 'mp4' : (mimeType || '').includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`);
    form.append('model', 'whisper-large-v3');
    form.append('language', 'es');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) return { ok: false, error: 'Límite de uso. Espera un momento.' };
      return { ok: false, error: `STT ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const text = (data.text || '').trim();
    if (!text) return { ok: false, error: 'No detecté palabras. Habla más cerca del micrófono.' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message || 'Error de reconocimiento' };
  }
});

ipcMain.handle('stt-listen-python', async (_e, seconds) => runPythonStt(seconds || 5));

ipcMain.handle('agent-chat', async (_e, { message, history }) => {
  ensureDefaultConfig();
  const config = getConfig();
  if (!config.apiKey) {
    const simple = await trySimpleIntent(message);
    if (simple) return simple;
    return fallbackResponse(message);
  }
  try {
    const result = await runAgent(message, history || [], agentHelpers);
    return { response: result.response, intelligent: true };
  } catch (err) {
    if (/429|rate limit/i.test(String(err.message))) {
      return { response: 'El servicio está saturado un momento. Espera y vuelve a intentar.', intelligent: false };
    }
    return { response: 'No pude completar eso ahora. Revisa tu conexión.', intelligent: false };
  }
});

ipcMain.handle('agent-config-get', () => {
  const c = getConfig();
  return { hasKey: !!c.apiKey, baseUrl: c.baseUrl, model: c.model };
});
ipcMain.handle('agent-config-set', (_e, partial) => saveConfig(partial));

async function trySimpleIntent(input) {
  const text = input.toLowerCase().trim();
  if (/\b(abre|abrir)\b/.test(text)) {
    for (const f of ['documentos', 'descargas', 'escritorio', 'informes', 'imagenes', 'musica', 'videos']) {
      if (text.includes(f)) {
        const r = await openFolderHelper(f);
        return { response: r.message || r.result, intelligent: false };
      }
    }
    const m = text.match(/(?:abre|abrir)\s+(?:la\s+|el\s+)?(.+)/);
    if (m) {
      const r = await openAppHelper(m[1].replace(/\s+(por favor|please)$/i, '').trim());
      return { response: r.message || r.result, intelligent: false };
    }
  }
  if (/\b(qué hora|que hora|hora es)\b/.test(text)) {
    return { response: `Son las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`, intelligent: false };
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
    callback(permission === 'media' || permission === 'microphone' || permission === 'audioCapture');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    permission === 'media' || permission === 'microphone' || permission === 'audioCapture',
  );
  try {
    const cfgPath = path.join(os.homedir(), '.elyra', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const c = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (c.model === 'llama-3.3-70b-versatile') {
        c.model = 'llama-3.1-8b-instant';
        fs.writeFileSync(cfgPath, JSON.stringify(c, null, 2));
      }
    }
  } catch {}
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
