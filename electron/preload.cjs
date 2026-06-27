const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => process.env.npm_package_version || '0.0.0',
  isDesktop: true,
  platform: process.platform,
  onCompileStatus: (callback) => {
    ipcRenderer.on('compile-status', (_event, data) => callback(data));
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
