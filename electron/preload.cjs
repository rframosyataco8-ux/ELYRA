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

  agentChat: (message, history) => ipcRenderer.invoke('agent-chat', { message, history }),
  agentConfigGet: () => ipcRenderer.invoke('agent-config-get'),
  agentConfigSet: (partial) => ipcRenderer.invoke('agent-config-set', partial),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  onAutonomousMode: (cb) => {
    const handler = (_e, value) => cb(value);
    ipcRenderer.on('autonomous-mode', handler);
    return () => ipcRenderer.removeListener('autonomous-mode', handler);
  },

  isDesktop: true,
});
