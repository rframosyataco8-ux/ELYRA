const { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage, session } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { synthesizeToBase64, checkEdgeTts, VOICE } = require('./tts.cjs');
const {
  runAgent,
  getConfig,
  saveConfig,
  fallbackResponse,
  ensureDefaultConfig,
  normalizeUserIntent,
  testApiConnection,
} = require('./agent.cjs');
const { runPythonStt } = require('./stt-python-ipc.cjs');
const { openApp: openAppReliable, openUrl: openUrlReliable } = require('./apps.cjs');
const pc = require('./pc-bridge.cjs');
const { transcribeBuffer } = require('./stt.cjs');
const { chatOpenClaw, pingOpenClaw, getOpenClawConfig } = require('./openclaw-bridge.cjs');
const { routeChat } = require('./chat-router.cjs');
const { runPythonTool } = require('./python-bridge.cjs');

let mainWindow = null;
let floatingCore = null;
let productWindow = null;
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

function createFloatingCore() {
  if (floatingCore && !floatingCore.isDestroyed()) {
    floatingCore.show();
    return floatingCore;
  }
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  floatingCore = new BrowserWindow({
    width: 240,
    height: 260,
    x: sw - 280,
    y: Math.floor(sh / 2 - 130),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'ELYRA Núcleo',
    webPreferences: {
      preload: path.join(__dirname, 'preload-floating.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });
  floatingCore.setAlwaysOnTop(true, 'screen-saver');
  floatingCore.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingCore.loadFile(path.join(__dirname, 'floating-core.html'));
  floatingCore.once('ready-to-show', () => floatingCore.show());
  floatingCore.on('closed', () => {
    floatingCore = null;
  });
  return floatingCore;
}

function hideFloatingCore() {
  if (floatingCore && !floatingCore.isDestroyed()) {
    floatingCore.hide();
  }
}

function openProductWindow(productName) {
  if (productWindow && !productWindow.isDestroyed()) {
    productWindow.close();
  }
  // Ocultar ventana principal mientras se muestra el producto
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  productWindow = new BrowserWindow({
    width: 520,
    height: 360,
    minWidth: 400,
    minHeight: 280,
    backgroundColor: '#030810',
    title: productName || 'Producto',
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-product.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });
  const q = encodeURIComponent(productName || 'Producto');
  productWindow.loadFile(path.join(__dirname, 'product-window.html'), { query: { name: productName || 'Producto' } });
  productWindow.once('ready-to-show', () => productWindow.show());
  productWindow.on('closed', () => {
    productWindow = null;
    // Al cerrar el producto, volver a mostrar la principal
    if (mainWindow && !mainWindow.isDestroyed() && !isQuitting) {
      mainWindow.show();
    }
  });
  return productWindow;
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
async function openUrlHelper(url) {
  return openUrlReliable(url);
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
  if (!notes.length && !facts.length) {
    return {
      ok: true,
      result:
        'Aún no tengo notas guardadas. Puedes decirme "recuerda que..." y lo guardaré para la próxima vez.',
    };
  }
  const parts = [];
  if (notes.length) parts.push('Notas: ' + notes.join('. '));
  if (facts.length) parts.push('Hechos: ' + facts.join('. '));
  return { ok: true, result: parts.join(' ') };
}

async function getSystemStats() {
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
    return { cpu: 15, ram: 45, disk: 50, net: 10, hostname: os.hostname() };
  }
}

const agentHelpers = {
  openApp: openAppHelper,
  openFolder: openFolderHelper,
  openUrl: openUrlHelper,
  runCommand: runCommandHelper,
  remember: rememberHelper,
  recall: recallHelper,
  pc,
  getSystemStats,
  runPythonTool,
};

ipcMain.handle('get-system-stats', async () => getSystemStats());
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

ipcMain.handle('openclaw-status', async () => {
  const cfg = getOpenClawConfig();
  const ping = await pingOpenClaw();
  return { ...cfg, online: !!ping.ok, reason: ping.reason || null };
});

ipcMain.handle('agent-chat', async (_e, { message, history }) => {
  ensureDefaultConfig();
  return routeChat({
    message,
    history,
    helpers: agentHelpers,
    runAgent,
    getConfig,
    fallbackResponse,
    normalizeUserIntent,
    chatOpenClaw,
    getOpenClawConfig,
    pc,
    getSystemStats,
  });
});

ipcMain.handle('agent-config-get', () => {
  const c = getConfig();
  return { hasKey: !!c.apiKey, baseUrl: c.baseUrl, model: c.model, provider: c.provider };
});
ipcMain.handle('agent-config-set', (_e, partial) => {
  const next = saveConfig(partial || {});
  return { hasKey: !!next.apiKey, baseUrl: next.baseUrl, model: next.model, provider: next.provider };
});
ipcMain.handle('agent-config-test', async (_e, partial) => {
  return testApiConnection(partial || {});
});

// —— Producto y núcleo flotante ——
ipcMain.handle('open-product-window', (_e, productName) => {
  openProductWindow(productName || 'Producto');
  return { ok: true };
});
ipcMain.handle('close-product-window', () => {
  if (productWindow && !productWindow.isDestroyed()) productWindow.close();
  return { ok: true };
});
ipcMain.handle('show-floating-core', () => {
  createFloatingCore();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  return { ok: true };
});
ipcMain.handle('hide-floating-core', () => {
  hideFloatingCore();
  if (mainWindow && !mainWindow.isDestroyed() && !isQuitting) mainWindow.show();
  return { ok: true };
});
ipcMain.handle('floating-core-state', (_e, state) => {
  if (floatingCore && !floatingCore.isDestroyed()) {
    floatingCore.webContents.send('floating-state', state || {});
  }
  return { ok: true };
});

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
  if (floatingCore && !floatingCore.isDestroyed()) floatingCore.destroy();
  if (productWindow && !productWindow.isDestroyed()) productWindow.destroy();
});
