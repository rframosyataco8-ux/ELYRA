const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elyra', {
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  openApp: (name) => ipcRenderer.invoke('open-app', name),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  openFolder: (folder) => ipcRenderer.invoke('open-folder', folder),
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),

  memoryGet: () => ipcRenderer.invoke('memory-get'),
  memoryAddNote: (note) => ipcRenderer.invoke('memory-add-note', note),
  memoryAddFact: (fact) => ipcRenderer.invoke('memory-add-fact', fact),
  memorySaveHistory: (entry) => ipcRenderer.invoke('memory-save-history', entry),
  memoryClear: () => ipcRenderer.invoke('memory-clear'),

  ttsSpeak: (text) => ipcRenderer.invoke('tts-speak', text),
  ttsStatus: () => ipcRenderer.invoke('tts-status'),

  sttTranscribe: (payload) => ipcRenderer.invoke('stt-transcribe', payload),
  sttListenPython: (seconds) => ipcRenderer.invoke('stt-listen-python', seconds),

  pcVolume: (action, value) => ipcRenderer.invoke('pc-volume', { action, value }),
  pcMedia: (action) => ipcRenderer.invoke('pc-media', { action }),
  pcBrightness: (action, value) => ipcRenderer.invoke('pc-brightness', { action, value }),
  pcClipboard: (action, text) => ipcRenderer.invoke('pc-clipboard', { action, text }),
  pcScreenshot: () => ipcRenderer.invoke('pc-screenshot'),
  pcListProcesses: () => ipcRenderer.invoke('pc-list-processes'),
  pcKillProcess: (name) => ipcRenderer.invoke('pc-kill-process', name),
  pcWindows: (action) => ipcRenderer.invoke('pc-windows', { action }),
  pcInput: (action, payload) => ipcRenderer.invoke('pc-input', { action, ...payload }),

  agentChat: (message, history) => ipcRenderer.invoke('agent-chat', { message, history }),
  agentConfigGet: () => ipcRenderer.invoke('agent-config-get'),
  agentConfigSet: (partial) => ipcRenderer.invoke('agent-config-set', partial),
  agentConfigTest: (partial) => ipcRenderer.invoke('agent-config-test', partial),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  openProductWindow: (name) => ipcRenderer.invoke('open-product-window', name),
  closeProductWindow: () => ipcRenderer.invoke('close-product-window'),
  showFloatingCore: () => ipcRenderer.invoke('show-floating-core'),
  hideFloatingCore: () => ipcRenderer.invoke('hide-floating-core'),
  floatingCoreState: (state) => ipcRenderer.invoke('floating-core-state', state),

  onAutonomousMode: (cb) => {
    const handler = (_e, value) => cb(value);
    ipcRenderer.on('autonomous-mode', handler);
    return () => ipcRenderer.removeListener('autonomous-mode', handler);
  },

  onBargeIn: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('elyra-barge-in', handler);
    return () => ipcRenderer.removeListener('elyra-barge-in', handler);
  },

  isDesktop: true,
});
