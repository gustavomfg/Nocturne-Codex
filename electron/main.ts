import { app, BrowserWindow, shell } from 'electron'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CodexClient } from './codex/CodexClient'
import { LocalDatabase } from './database/Database'
import { registerIpc } from './ipc/registerIpc'
import { Logger } from './logging/Logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.disableHardwareAcceleration()
process.env.APP_ROOT = path.join(__dirname, '..')
process.env.NOCTURNE_APP_RUNNING = '1'
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const APP_NAME = 'Nocturne Codex'
const APP_ICON = path.join(process.env.APP_ROOT, 'build', 'icon.png')
app.setName(APP_NAME)

let win: BrowserWindow | null = null
let database: LocalDatabase | null = null
const codex = new CodexClient()
let logger: Logger | null = null

process.on('uncaughtException', (error) => { logger?.error('app', 'uncaughtException no processo principal', error); console.error(error) })
process.on('unhandledRejection', (reason) => { logger?.error('app', 'unhandledRejection no processo principal', reason); console.error(reason) })

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 680,
    title: APP_NAME, icon: APP_ICON, backgroundColor: '#0b0b0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.on('page-title-updated', (event) => {
    event.preventDefault()
    win?.setTitle(APP_NAME)
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
  if (app.isPackaged && process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT) {
    const output = path.resolve(process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT)
    win.webContents.once('did-finish-load', () => {
      void runPackageSmoke(output)
    })
  }
  win.webContents.on('preload-error', (_event, preloadPath, error) => logger?.error('app', `Falha no preload: ${preloadPath}`, error))
  win.webContents.on('did-fail-load', (_event, code, description, url) => logger?.error('app', 'Falha ao carregar renderer', { code, description, url }))
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) logger?.warn('app', 'Console do renderer', { level, message: message.slice(0, 8_000), line, sourceId })
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('app', 'Renderer encerrado inesperadamente', details)
    codex.stop()
    if (!win?.isDestroyed()) setTimeout(() => { if (win && !win.isDestroyed()) void win.webContents.reload() }, 1_000)
  })
  win.webContents.on('unresponsive', () => logger?.warn('app', 'Renderer não está respondendo'))
  win.webContents.on('responsive', () => logger?.info('app', 'Renderer voltou a responder'))
  const memoryTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !['planning', 'running', 'waiting-approval', 'cancelling'].includes(codex.status)) return
    const renderer = app.getAppMetrics().find((metric) => metric.pid === win?.webContents.getOSProcessId())
    logger?.info('app', 'Uso de memória durante execução', { main: process.memoryUsage(), renderer: renderer?.memory, codex: codex.getDiagnostics() })
  }, 10_000)
  win.on('closed', () => clearInterval(memoryTimer))
  if (VITE_DEV_SERVER_URL) void win.loadURL(VITE_DEV_SERVER_URL)
  else void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
}

async function runPackageSmoke(output: string) {
  try {
    const preload = await win?.webContents.executeJavaScript(`(() => {
      const api = window.nocturne
      return { available: Boolean(api), settings: typeof api?.settings?.get === 'function', channels: api ? Object.keys(api).sort() : [] }
    })()` ) as { available: boolean; settings: boolean; channels: string[] } | undefined
    const sqlite = Boolean(database?.listConversations())
    fs.writeFileSync(output, `${JSON.stringify({ ok: Boolean(preload?.available && preload.settings && sqlite), packaged: app.isPackaged, preload, sqlite })}\n`, { encoding: 'utf8', mode: 0o600 })
    app.quit()
  } catch (error) {
    fs.writeFileSync(output, `${JSON.stringify({ ok: false, packaged: app.isPackaged, error: error instanceof Error ? error.message : String(error) })}\n`, { encoding: 'utf8', mode: 0o600 })
    app.exit(1)
  }
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('before-quit', () => { logger?.info('app', 'Encerrando aplicação'); codex.stop(); database?.close() })
app.on('child-process-gone', (_event, details) => logger?.error('app', 'Processo filho do Electron encerrado', details))
void app.whenReady().then(createWindow)
