import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CodexClient } from './codex/CodexClient'
import { LocalDatabase } from './database/Database'
import { registerIpc } from './ipc/registerIpc'
import { Logger } from './logging/Logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.disableHardwareAcceleration()
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let win: BrowserWindow | null = null
let database: LocalDatabase | null = null
const codex = new CodexClient()
let logger: Logger | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 680,
    title: 'Nocturne Codex', backgroundColor: '#0b0b0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { const parsed = new URL(url); if (parsed.protocol === 'https:') void shell.openExternal(parsed.toString()) } catch { /* deny malformed URL */ }
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = VITE_DEV_SERVER_URL ? url.startsWith(VITE_DEV_SERVER_URL) : url.startsWith('file:')
    if (!allowed) event.preventDefault()
  })

  database = new LocalDatabase(app.getPath('userData'))
  logger = new Logger(app.getPath('logs'), database.getSettings().diagnosticMode === 'true')
  logger.info('app', 'Janela principal iniciada', { packaged: app.isPackaged })
  registerIpc(win, database, codex, logger)
  if (VITE_DEV_SERVER_URL) void win.loadURL(VITE_DEV_SERVER_URL)
  else void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('before-quit', () => { logger?.info('app', 'Encerrando aplicação'); codex.stop(); database?.close() })
void app.whenReady().then(createWindow)
