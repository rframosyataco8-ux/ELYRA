const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elyraProduct', {
  close: () => ipcRenderer.invoke('close-product-window'),
  minimize: () => ipcRenderer.invoke('product-window-minimize'),
  maximize: () => ipcRenderer.invoke('product-window-maximize'),
});
