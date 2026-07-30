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
const { openApp: openAppReliable, openUrl: openUrlReliable, resolveWebUrl } = require('./apps.cjs');
const pc = require('./pc-control.cjs');
const { transcribeBuffer } = require('./stt.cjs');
const { chatOpenClaw, pingOpenClaw, getOpenClawConfig } = require('./openclaw-bridge.cjs');

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

/** Búsqueda rápida Wikipedia / DuckDuckGo sin LLM (modo autónomo) */
async function knowledgeLookup(query) {
  const q = (query || '').trim().slice(0, 120);
  if (!q) return null;
  const bits = [];
  try {
    const wr = await fetch(
      'https://es.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q),
      { headers: { 'User-Agent': 'ELYRA/3.1' } },
    );
    if (wr.ok) {
      const data = await wr.json();
      if (data.extract) bits.push(data.extract);
      else if (data.type === 'disambiguation' && data.extract) bits.push(data.extract);
    }
  } catch {}
  if (!bits.length) {
    try {
      const wr2 = await fetch(
        'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q),
        { headers: { 'User-Agent': 'ELYRA/3.1' } },
      );
      if (wr2.ok) {
        const data = await wr2.json();
        if (data.extract) bits.push(data.extract);
      }
    } catch {}
  }
  if (!bits.length) {
    try {
      const res = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1',
        { headers: { 'User-Agent': 'ELYRA/3.1' } },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.AbstractText) bits.push(data.AbstractText);
        else if (data.RelatedTopics?.[0]?.Text) bits.push(data.RelatedTopics[0].Text);
      }
    } catch {}
  }
  if (!bits.length) return null;
  return bits.join(' ').replace(/\s+/g, ' ').trim().slice(0, 900);
}

function extractKnowledgeTopic(text) {
  const t = (text || '').trim();
  const patterns = [
    /(?:dime|cuéntame|cuentame|explícame|explicame|qué sabes|que sabes|habla|información|informacion|busca|busca info)\s+(?:sobre|de|acerca de)\s+(.+)/i,
    /(?:qué es|que es|quién es|quien es|quién fue|quien fue)\s+(.+)/i,
    /(?:busca|buscar|investiga|investigar)\s+(.+)/i,
    /(?:resume|resumen de|haz un resumen de)\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) return m[1].replace(/[?.!]+$/, '').trim();
  }
  return null;
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

ipcMain.handle('openclaw-status', async () => {
  const cfg = getOpenClawConfig();
  const ping = await pingOpenClaw();
  return { ...cfg, online: !!ping.ok, reason: ping.reason || null };
});

ipcMain.handle('agent-chat', async (_e, { message, history }) => {
  ensureDefaultConfig();
  const fixed = typeof normalizeUserIntent === 'function' ? normalizeUserIntent(message) : message;

  const quick = await trySimpleIntent(fixed);
  if (quick) return quick;

  const oc = getOpenClawConfig();
  if (oc.enabled) {
    const ocRes = await chatOpenClaw(fixed, history || []);
    if (ocRes.ok && ocRes.response) {
      return { response: ocRes.response, intelligent: true, via: 'openclaw' };
    }
  }

  const config = getConfig();
  if (!config.apiKey) {
    // Autonomía sin key: conocimiento web + memoria
    const topic = extractKnowledgeTopic(fixed);
    if (topic) {
      const info = await knowledgeLookup(topic);
      if (info) return { response: info, intelligent: true, via: 'wiki' };
    }
    return fallbackResponse(message);
  }

  try {
    const result = await runAgent(fixed, history || [], agentHelpers);
    // Si el agente solo devolvió error de API, intenta conocimiento local
    if (/api key no es válida|no hay api key|falta la api|no pude conectar/i.test(result.response || '')) {
      const topic = extractKnowledgeTopic(fixed);
      if (topic) {
        const info = await knowledgeLookup(topic);
        if (info) {
          return {
            response:
              info +
              ' (Respuesta desde Wikipedia porque la API key no respondió. Revísala en Configuración.)',
            intelligent: true,
            via: 'wiki-fallback',
          };
        }
      }
    }
    return { response: result.response, intelligent: true, via: 'llm' };
  } catch (err) {
    if (/429|rate limit/i.test(String(err.message))) {
      return { response: 'El servicio está saturado un momento.', intelligent: false };
    }
    const topic = extractKnowledgeTopic(fixed);
    if (topic) {
      const info = await knowledgeLookup(topic);
      if (info) return { response: info, intelligent: true, via: 'wiki-fallback' };
    }
    return { response: 'No pude completar eso ahora. Revisa la API key en Configuración si el problema continúa.', intelligent: false };
  }
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

async function trySimpleIntent(input) {
  const text = (input || '').toLowerCase().trim();

  // Memoria
  if (
    /\b(qué recuerdas|que recuerdas|dime (todo )?lo que recuerdas|qué sabes de mí|que sabes de mi|tu memoria|muestra (tu )?memoria)\b/.test(
      text,
    )
  ) {
    const r = await recallHelper();
    return { response: r.result, intelligent: false };
  }
  const rememberMatch = text.match(
    /\b(?:recuerda|anota|guarda|no olvides)\s+(?:que\s+)?(.+)/i,
  );
  if (rememberMatch) {
    await rememberHelper(rememberMatch[1].trim());
    return { response: 'Listo, lo guardé en mi memoria.', intelligent: false };
  }

  // Volumen
  if (/\b(sube|subir)\s+(el\s+)?volumen\b/.test(text)) {
    const r = await pc.volume('up');
    return { response: r.result, intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?volumen\b/.test(text)) {
    const r = await pc.volume('down');
    return { response: r.result, intelligent: false };
  }
  if (/\b(silencia|mute|silencio)\b/.test(text)) {
    const r = await pc.volume('mute');
    return { response: r.result, intelligent: false };
  }

  // Brillo
  if (/\b(sube|subir)\s+(el\s+)?brillo\b/.test(text)) {
    const r = await pc.brightness('up');
    return { response: r.result, intelligent: false };
  }
  if (/\b(baja|bajar)\s+(el\s+)?brillo\b/.test(text)) {
    const r = await pc.brightness('down');
    return { response: r.result, intelligent: false };
  }

  // Media
  if (
    (/\b(pausa|pausar|play|reproducir|reproduce)\b/.test(text) &&
      /\b(música|musica|canción|cancion|spotify|video)\b/.test(text)) ||
    /\b(pausa|reanuda|play pause)\b/.test(text)
  ) {
    const r = await pc.media('play');
    return { response: r.result, intelligent: false };
  }
  if (/\b(siguiente|next)\s+(canción|cancion|pista)?\b/.test(text)) {
    const r = await pc.media('next');
    return { response: r.result, intelligent: false };
  }
  if (/\b(anterior|prev)\s+(canción|cancion|pista)?\b/.test(text)) {
    const r = await pc.media('prev');
    return { response: r.result, intelligent: false };
  }

  // Captura / bloqueo / escritorio
  if (/\b(captura|screenshot|captura de pantalla)\b/.test(text)) {
    const r = await pc.screenshot();
    return { response: r.result, intelligent: false };
  }
  if (/\b(bloquea|bloquear)\s+(la\s+)?(sesión|pc|pantalla)\b/.test(text)) {
    const r = await pc.windows('lock');
    return { response: r.result, intelligent: false };
  }
  if (/\b(minimiza|minimizar)\s+(todas|ventanas|todo)\b/.test(text) || /\bmostrar escritorio\b/.test(text)) {
    const r = await pc.windows('minimize_all');
    return { response: r.result, intelligent: false };
  }
  if (/\b(apaga|apagar)\s+(la\s+)?pantalla\b/.test(text)) {
    const r = await pc.windows('screen_off');
    return { response: r.result, intelligent: false };
  }

  // Batería / red / disco
  if (/\b(batería|bateria|cuánta batería|cuanta bateria)\b/.test(text)) {
    const r = await pc.battery();
    return { response: r.result, intelligent: false };
  }
  if (/\b(estado de (la )?red|mi ip|wifi|conexión|conexion)\b/.test(text)) {
    const r = await pc.networkInfo();
    return { response: (r.result || '').slice(0, 400), intelligent: false };
  }
  if (/\b(espacio en disco|disco libre|cuánto disco)\b/.test(text)) {
    const r = await pc.systemExtras('disk_space');
    return { response: (r.result || '').slice(0, 400), intelligent: false };
  }

  // Papelera
  if (/\b(vacía|vacia|vaciar)\s+(la\s+)?papelera\b/.test(text)) {
    const r = await pc.emptyRecycle();
    return { response: r.result, intelligent: false };
  }

  // Ajustes Windows
  if (/\b(abre|abrir)\s+(ajustes|configuración|configuracion|settings)\b/.test(text)) {
    let page = 'system';
    if (/wifi|red/.test(text)) page = 'wifi';
    else if (/bluetooth/.test(text)) page = 'bluetooth';
    else if (/pantalla|display/.test(text)) page = 'display';
    else if (/sonido|audio/.test(text)) page = 'sound';
    else if (/privacidad/.test(text)) page = 'privacy';
    else if (/actualiz/.test(text)) page = 'update';
    const r = await pc.openSettings(page);
    return { response: r.result, intelligent: false };
  }

  // Power
  if (/\b(cancela|cancelar)\s+(el\s+)?(apagado|reinicio)\b/.test(text) || /\bcancelar apagado\b/.test(text)) {
    const r = await pc.power('cancel');
    return { response: r.result, intelligent: false };
  }
  if (/\b(apaga|apagar)\s+(el\s+)?(pc|equipo|ordenador)\b/.test(text) && !/pantalla/.test(text)) {
    const r = await pc.power('shutdown', 1);
    return { response: r.result, intelligent: false };
  }
  if (/\b(reinicia|reiniciar)\s+(el\s+)?(pc|equipo)?\b/.test(text)) {
    const r = await pc.power('restart', 1);
    return { response: r.result, intelligent: false };
  }
  if (/\b(suspende|suspender|duerme|modo sueño)\b/.test(text)) {
    const r = await pc.power('sleep');
    return { response: r.result, intelligent: false };
  }

  if (/\b(notifica|notificación|notificacion)\b/.test(text)) {
    const r = await pc.notify('ELYRA', 'Sistemas operativos. Notificación de prueba.');
    return { response: r.result, intelligent: false };
  }

  // Conocimiento rápido (sin esperar LLM)
  const topic = extractKnowledgeTopic(text);
  if (topic && topic.length > 2) {
    const info = await knowledgeLookup(topic);
    if (info) return { response: info, intelligent: true, via: 'wiki' };
  }

  // Abrir apps / webs / carpetas
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
      const candidates = [
        'youtube', 'google', 'gmail', 'facebook', 'instagram', 'netflix', 'github',
        'word', 'excel', 'chrome', 'edge', 'notepad', 'calculadora', 'spotify',
        'discord', 'code', 'firefox', 'paint', 'powerpoint', 'outlook', 'whatsapp',
        'teams', 'steam', 'slack', 'chatgpt', 'gemini', 'claude',
      ];
      for (const app of candidates) {
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
