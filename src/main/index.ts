import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc'
import { registerKaraokeHandler, registerKaraokeScheme } from './protocol'

registerKaraokeScheme()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    title: 'Singray',
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0E0E12',
    // Frameless (R2.1): renderer draws the titlebar. NAV1 drops the native
    // caption overlay in favor of custom min/max/close (window:* IPC) — the
    // snap-layouts hover flyout is lost, but drag-to-edge snap + double-click
    // maximize on the drag region still work.
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox:false required — the preload uses Node.js APIs (contextBridge, ipcRenderer,
      // webUtils) that the sandbox disables. contextIsolation (default true) still prevents
      // renderer code from accessing Node.
      sandbox: false,
      // Keep rAF running while occluded/minimized — the lyric renderer must not
      // freeze mid-song when another window covers the player.
      backgroundThrottling: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-changed', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-changed', false))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.singray.app')

  registerKaraokeHandler()
  registerIpc()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
