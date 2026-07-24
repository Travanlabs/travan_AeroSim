const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveDesign: (data) => ipcRenderer.invoke('dialog:save-design', data),
  exportReport: (content) => ipcRenderer.invoke('dialog:export-report', content),

  // App info
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPath: (name) => ipcRenderer.invoke('app:get-path', name),

  // Logging
  log: (msg) => ipcRenderer.send('app:log', msg),

  // Menu event listeners (main → renderer)
  onMenuAction: (callback) => {
    const events = [
      'menu:new-design', 'menu:open-design', 'menu:save-design',
      'menu:export-report', 'menu:run-sim', 'menu:run-airflow',
      'menu:run-fea', 'menu:run-mach', 'menu:run-polar',
      'menu:view', 'menu:show-manual',
    ]
    events.forEach(evt => {
      ipcRenderer.on(evt, (_, ...args) => callback(evt, ...args))
    })
  },

  // Platform
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
