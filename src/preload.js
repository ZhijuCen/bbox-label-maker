
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  loadImage: (filePath) => ipcRenderer.invoke('fs:readImage', filePath),
  saveAnnotations: (filePath, data) => 
    ipcRenderer.invoke('fs:saveAnnotations', { 
      filePath,
      data 
    }),
  loadAnnotations: (filePath) =>
    ipcRenderer.invoke('fs:loadAnnotations', filePath),
  receive: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args))
  }
});

// 暴露必要的path模块方法
contextBridge.exposeInMainWorld('nodeAPI', {
  joinPath: (...paths) => path.join(...paths),
  basename: (filePath) => path.basename(filePath)
});

// 暴露 tfjsAPI
contextBridge.exposeInMainWorld('tfjsAPI', {
  detectObjectsSSD: (imageData) => ipcRenderer.invoke('tfjs:detectObjectsSSD', imageData)
});

// 暴露 ortAPI
contextBridge.exposeInMainWorld('ortAPI', {
  detectObjectsYOLO: (imageData) => ipcRenderer.invoke('ort:detectObjectsYOLO', imageData)
});
