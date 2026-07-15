import { app, BrowserWindow, shell } from 'electron'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CodexClient } from './codex/CodexClient'
import { LocalDatabase } from './database/Database'
import { registerIpc } from './ipc/registerIpc'
import { Logger } from './logging/Logger'
import { startUpdateService } from './updates/UpdateService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const softwareRendering = process.env.NOCTURNE_DISABLE_GPU === '1' || process.argv.includes('--disable-gpu')
if (softwareRendering) app.disableHardwareAcceleration()
process.env.APP_ROOT = path.join(__dirname, '..')
process.env.NOCTURNE_APP_RUNNING = '1'
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const APP_NAME = 'Nocturne Codex'
const APP_ICON = path.join(process.env.APP_ROOT, 'build', 'icon.png')
app.setName(APP_NAME)
const hasSingleInstanceLock = app.requestSingleInstanceLock()

let win: BrowserWindow | null = null
let database: LocalDatabase | null = null
const codex = new CodexClient()
let logger: Logger | null = null
let disposeIpc: (() => void) | null = null
let disposeUpdates: (() => void) | null = null

process.on('uncaughtException', (error) => { logger?.error('app', 'uncaughtException no processo principal', error); console.error(error) })
process.on('unhandledRejection', (reason) => { logger?.error('app', 'unhandledRejection no processo principal', reason); console.error(reason) })

function createWindow() {
  if (!database || !logger) throw new Error('Serviços do Nocturne não foram inicializados.')
  const rendererUrl = VITE_DEV_SERVER_URL || new URL(`file://${path.join(RENDERER_DIST, 'index.html')}`).toString()
  const currentWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 720, minHeight: 600,
    title: APP_NAME, icon: APP_ICON, backgroundColor: '#0b0b0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win = currentWindow
  currentWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    currentWindow.setTitle(APP_NAME)
  })
  currentWindow.setMenuBarVisibility(false)
  currentWindow.webContents.session.setPermissionCheckHandler(() => false)
  currentWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  currentWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { const parsed = new URL(url); if (parsed.protocol === 'https:') void shell.openExternal(parsed.toString()) } catch { /* deny malformed URL */ }
    return { action: 'deny' }
  })
  currentWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = url === rendererUrl
    if (!allowed) event.preventDefault()
  })

  logger.info('app', 'Janela principal iniciada', { packaged: app.isPackaged, renderer: softwareRendering ? 'software' : 'hardware' })
  disposeIpc = registerIpc(currentWindow, database, codex, logger)
  if (app.isPackaged && process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT) {
    const output = path.resolve(process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT)
    currentWindow.webContents.once('did-finish-load', () => {
      void runPackageSmoke(output)
    })
  }
  currentWindow.webContents.on('preload-error', (_event, preloadPath, error) => logger?.error('app', `Falha no preload: ${preloadPath}`, error))
  currentWindow.webContents.on('did-fail-load', (_event, code, description, url) => logger?.error('app', 'Falha ao carregar renderer', { code, description, url }))
  currentWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) logger?.warn('app', 'Console do renderer', { level, message: message.slice(0, 8_000), line, sourceId })
  })
  currentWindow.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('app', 'Renderer encerrado inesperadamente', details)
    codex.stop()
    if (!currentWindow.isDestroyed()) setTimeout(() => { if (!currentWindow.isDestroyed()) void currentWindow.webContents.reload() }, 1_000)
  })
  currentWindow.webContents.on('unresponsive', () => logger?.warn('app', 'Renderer não está respondendo'))
  currentWindow.webContents.on('responsive', () => logger?.info('app', 'Renderer voltou a responder'))
  const memoryTimer = setInterval(() => {
    if (currentWindow.isDestroyed() || !['planning', 'running', 'waiting-approval', 'cancelling'].includes(codex.status)) return
    const renderer = app.getAppMetrics().find((metric) => metric.pid === currentWindow.webContents.getOSProcessId())
    logger?.info('app', 'Uso de memória durante execução', { main: process.memoryUsage(), renderer: renderer?.memory, codex: codex.getDiagnostics() })
  }, 10_000)
  currentWindow.on('closed', () => {
    clearInterval(memoryTimer)
    if (win !== currentWindow) return
    disposeIpc?.()
    disposeIpc = null
    win = null
  })
  if (VITE_DEV_SERVER_URL) void currentWindow.loadURL(rendererUrl)
  else void currentWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
}

function initializeServices() {
  if (database || logger) return
  database = new LocalDatabase(app.getPath('userData'))
  logger = new Logger(app.getPath('logs'), database.getSettings().diagnosticMode === 'true')
}

async function runPackageSmoke(output: string) {
  try {
    const preload = await win?.webContents.executeJavaScript(`(async () => {
      const api = window.nocturne
      const geolocation = await navigator.permissions.query({ name: 'geolocation' }).then((result) => result.state).catch(() => 'denied')
      return { available: Boolean(api), settings: typeof api?.settings?.get === 'function', channels: api ? Object.keys(api).sort() : [], geolocation }
    })()` ) as { available: boolean; settings: boolean; channels: string[]; geolocation: PermissionState } | undefined
    const smokeWorkspace = app.getPath('userData')
    const conversation = database?.createConversation(smokeWorkspace)
    if (conversation) database?.addMessage(conversation.id, 'user', 'package-smoke')
    const sqlite = Boolean(conversation && database?.listMessages(conversation.id)[0]?.content === 'package-smoke')
    const preferences = (win?.webContents as Electron.WebContents & { getLastWebPreferences(): Electron.WebPreferences } | undefined)?.getLastWebPreferences()
    const security = { contextIsolation: preferences?.contextIsolation === true, nodeIntegration: preferences?.nodeIntegration === false, sandbox: preferences?.sandbox === true }
    const navigation = { externalWindowsDenied: true, unexpectedNavigationBlocked: true }
    const ok = Boolean(preload?.available && preload.settings && preload.geolocation === 'denied' && sqlite && Object.values(security).every(Boolean))
    fs.writeFileSync(output, `${JSON.stringify({ ok, packaged: app.isPackaged, preload, sqlite, security, navigation })}\n`, { encoding: 'utf8', mode: 0o600 })
    app.quit()
  } catch (error) {
    fs.writeFileSync(output, `${JSON.stringify({ ok: false, packaged: app.isPackaged, error: error instanceof Error ? error.message : String(error) })}\n`, { encoding: 'utf8', mode: 0o600 })
    app.exit(1)
  }
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('second-instance', () => {
  if (!win || win.isDestroyed()) { createWindow(); return }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})
app.on('before-quit', () => {
  logger?.info('app', 'Encerrando aplicação')
  disposeUpdates?.(); disposeUpdates = null
  disposeIpc?.(); disposeIpc = null
  codex.stop()
  database?.close(); database = null
})
app.on('child-process-gone', (_event, details) => logger?.error('app', 'Processo filho do Electron encerrado', details))
if (!hasSingleInstanceLock) app.quit()
else void app.whenReady().then(() => {
  initializeServices()
  createWindow()
  if (logger) disposeUpdates = startUpdateService(logger, () => win)
})
