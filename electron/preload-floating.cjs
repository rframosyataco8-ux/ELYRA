const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elyraFloating', {
  onState: (cb) => {
    const handler = (_e, state) => cb(state || {});
    ipcRenderer.on('floating-state', handler);
    return () => ipcRenderer.removeListener('floating-state', handler);
  },
});
