const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elyraProduct', {
  close: () => ipcRenderer.invoke('close-product-window'),
});
