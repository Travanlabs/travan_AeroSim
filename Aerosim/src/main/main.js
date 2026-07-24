const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs')
const log = require('electron-log')

// ── Logging setup ──────────────────────────────────────────────
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.info('Travan Aero Simulator starting up...')

// ── Dev / Prod detection ───────────────────────────────────────
const isDev = !app.isPackaged

let mainWindow = null

// ── Create Main Window ─────────────────────────────────────────
function createWindow() {
  nativeTheme.themeSource = 'dark'

  mainWindow = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1280,
    minHeight: 768,
    title: 'Travan Aero Simulator v2.0',
    backgroundColor: '#03060e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
    },
  })

  // Load renderer
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    log.info('Main window shown')
  })

  mainWindow.on('closed', () => { mainWindow = null })

  buildMenu()
}

// ── App Menu ───────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Design',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-design'),
        },
        {
          label: 'Open Design...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Open TAS Design File',
              filters: [{ name: 'TAS Design', extensions: ['tas', 'json'] }],
              properties: ['openFile'],
            })
            if (filePaths[0]) {
              const data = fs.readFileSync(filePaths[0], 'utf8')
              mainWindow?.webContents.send('menu:open-design', JSON.parse(data))
            }
          },
        },
        {
          label: 'Save Design',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save-design'),
        },
        { type: 'separator' },
        {
          label: 'Export Report (PDF)',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export-report'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Simulation',
      submenu: [
        {
          label: 'Run Full Simulation',
          accelerator: 'F5',
          click: () => mainWindow?.webContents.send('menu:run-sim'),
        },
        {
          label: 'Run Airflow Only',
          accelerator: 'F6',
          click: () => mainWindow?.webContents.send('menu:run-airflow'),
        },
        {
          label: 'Run FEA Only',
          accelerator: 'F7',
          click: () => mainWindow?.webContents.send('menu:run-fea'),
        },
        {
          label: 'Run Shock Analysis',
          accelerator: 'F8',
          click: () => mainWindow?.webContents.send('menu:run-mach'),
        },
        { type: 'separator' },
        {
          label: 'Polar Sweep',
          accelerator: 'F9',
          click: () => mainWindow?.webContents.send('menu:run-polar'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: '3D Perspective',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('menu:view', '3d'),
        },
        {
          label: 'Top View',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('menu:view', 'top'),
        },
        {
          label: 'Side View',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow?.webContents.send('menu:view', 'side'),
        },
        {
          label: 'Front View',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow?.webContents.send('menu:view', 'front'),
        },
        {
          label: 'Quad View',
          accelerator: 'CmdOrCtrl+Q',
          click: () => mainWindow?.webContents.send('menu:view', 'quad'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Manual',
          click: () => mainWindow?.webContents.send('menu:show-manual'),
        },
        {
          label: 'Engineering References',
          click: () => shell.openExternal('https://www.aeronautics.nasa.gov/'),
        },
        { type: 'separator' },
        {
          label: 'About Travan Aero Simulator',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Travan Aero Simulator',
              message: 'Travan Aero Simulator v2.0',
              detail:
                'Professional Aerospace Analysis Suite\n\n' +
                'Author: Dickson Tawiah Aman, ARAeS\n' +
                'Travan Engineering / RhoPhi Holdings\n\n' +
                `Electron: ${process.versions.electron}\n` +
                `Node: ${process.versions.node}\n` +
                `Chrome: ${process.versions.chrome}\n` +
                `Platform: ${process.platform}`,
              buttons: ['OK'],
              icon: path.join(__dirname, '../../assets/icon.png'),
            })
          },
        },
      ],
    },
  ]

  if (process.platform === 'darwin') {
    template.unshift({ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC Handlers ───────────────────────────────────────────────
ipcMain.handle('dialog:save-design', async (_, data) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save TAS Design',
    defaultPath: 'design.tas',
    filters: [{ name: 'TAS Design', extensions: ['tas'] }],
  })
  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return { success: true, path: filePath }
  }
  return { success: false }
})

ipcMain.handle('dialog:export-report', async (_, htmlContent) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Aerodynamic Report',
    defaultPath: `TAS_Report_${new Date().toISOString().slice(0, 10)}.txt`,
    filters: [{ name: 'Text Report', extensions: ['txt'] }],
  })
  if (filePath) {
    fs.writeFileSync(filePath, htmlContent)
    shell.openPath(filePath)
    return { success: true, path: filePath }
  }
  return { success: false }
})

ipcMain.handle('app:get-version', () => app.getVersion())
ipcMain.handle('app:get-path', (_, name) => app.getPath(name))

ipcMain.on('app:log', (_, msg) => log.info('[Renderer]', msg))

// ── App lifecycle ──────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isDev) event.preventDefault()
  })
})

log.info('Main process initialised')
