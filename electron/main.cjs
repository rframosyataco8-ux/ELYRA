const { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');

const execAsync = promisify(exec);

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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Modo autónomo',
      type: 'checkbox',
      checked: true,
      click: (item) => {
        mainWindow?.webContents.send('autonomous-mode', item.checked);
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
  ]);
  tray.setToolTip('ELYRA — Asistente Inteligente');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

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
      arch: os.arch(),
      totalMemGB: +(totalMem / 1024 / 1024 / 1024).toFixed(1),
      freeMemGB: +(freeMem / 1024 / 1024 / 1024).toFixed(1),
    };
  } catch (err) {
    return { cpu: 15, ram: 45, disk: 50, net: 10, error: String(err) };
  }
});

ipcMain.handle('open-app', async (_event, appName) => {
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

    return { ok: true, message: `Abriendo ${appName}` };
  } catch (err) {
    return { ok: false, message: `No pude abrir "${appName}": ${err.message}` };
  }
});

ipcMain.handle('open-path', async (_event, targetPath) => {
  try {
    const result = await shell.openPath(targetPath);
    if (result) return { ok: false, message: result };
    return { ok: true, message: `Abierto: ${targetPath}` };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
});

ipcMain.handle('open-url', async (_event, url) => {
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
});

ipcMain.handle('open-folder', async (_event, folder) => {
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
    };
    const target = map[folder.toLowerCase()] || folder;
    await shell.openPath(target);
    return { ok: true, message: `Abriendo carpeta ${folder}` };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
});

ipcMain.handle('run-command', async (_event, command) => {
  try {
    const blocked = [/rm\s+-rf\s+\//, /format\s+/i, /del\s+\/s/i, /shutdown/i, /mkfs/i];
    if (blocked.some((re) => re.test(command))) {
      return { ok: false, message: 'Comando bloqueado por seguridad.' };
    }
    const { stdout, stderr } = await execAsync(command, {
      timeout: 15000,
      maxBuffer: 1024 * 512,
      shell: true,
    });
    return { ok: true, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 500) };
  } catch (err) {
    return { ok: false, message: err.message, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
});

function getMemoryPath() {
  return path.join(app.getPath('userData'), 'elyra-memory.json');
}

function readMemory() {
  try {
    const p = getMemoryPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
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

ipcMain.handle('memory-get', () => readMemory());

ipcMain.handle('memory-add-note', (_event, note) => {
  const mem = readMemory();
  mem.notes.push({ id: Date.now().toString(), text: note, at: new Date().toISOString() });
  writeMemory(mem);
  return { ok: true };
});

ipcMain.handle('memory-add-fact', (_event, fact) => {
  const mem = readMemory();
  mem.facts.push({ id: Date.now().toString(), text: fact, at: new Date().toISOString() });
  writeMemory(mem);
  return { ok: true };
});

ipcMain.handle('memory-save-history', (_event, entry) => {
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
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
