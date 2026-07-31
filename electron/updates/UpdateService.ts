import { app, BrowserWindow, dialog } from 'electron'
import electronUpdater, { type AppUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { Logger } from '../logging/Logger'

const CHECK_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

export function startUpdateService(logger: Logger, getWindow: () => BrowserWindow | null, updater: AppUpdater = getAutoUpdater()): () => void {
  if (!app.isPackaged || process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT) return () => undefined

  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.logger = {
    debug: (message) => logger.debug('update', String(message)),
    info: (message) => logger.info('update', String(message)),
    warn: (message) => logger.warn('update', String(message)),
    error: (message) => logger.error('update', String(message)),
  }

  let disposed = false
  let checking = false
  let promptingDownload = false
  let downloadRequested = false
  let promptingInstall = false
  let promptingRetry = false
  let availableUpdate: UpdateInfo | null = null
  const setProgress = (value: number) => {
    const window = getWindow()
    if (window && !window.isDestroyed()) window.setProgressBar(value)
  }
  const startDownload = async () => {
    if (disposed || downloadRequested) return
    downloadRequested = true
    try {
      await updater.downloadUpdate()
    } catch (error) {
      await handleDownloadFailure(error)
    }
  }
  const handleDownloadFailure = async (error: unknown) => {
    downloadRequested = false
    setProgress(-1)
    logger.warn('update', 'Download da atualização interrompido.', error)
    if (disposed || promptingRetry || !availableUpdate) return
    promptingRetry = true
    try {
      const { response } = await showMessage(getWindow(), {
        type: 'warning',
        title: 'Download interrompido',
        message: `Não foi possível concluir o download do Nocturne Studio ${availableUpdate.version}.`,
        detail: 'A conexão pode ter sido perdida. Tente retomar; o pacote será validado novamente antes da instalação.',
        buttons: ['Retomar download', 'Mais tarde'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      if (!disposed && response === 0) await startDownload()
    } catch (dialogError) {
      logger.warn('update', 'Não foi possível oferecer a retomada da atualização.', dialogError)
    } finally {
      promptingRetry = false
    }
  }
  const check = () => {
    if (disposed || checking) return
    checking = true
    void updater.checkForUpdates()
      .catch((error) => logger.warn('update', 'Não foi possível consultar atualizações.', error))
      .finally(() => { checking = false })
  }
  const onAvailable = (info: UpdateInfo) => {
    if (disposed || promptingDownload || downloadRequested) return
    availableUpdate = info
    promptingDownload = true
    const releaseNotes = formatReleaseNotes(info.releaseNotes)
    void showMessage(getWindow(), {
      type: 'info',
      title: 'Atualização disponível',
      message: `Nocturne Studio ${info.version} está disponível.`,
      detail: `${releaseNotes ? `Notas da versão:\n${releaseNotes}\n\n` : ''}Deseja baixar a atualização agora? Você poderá continuar usando o aplicativo durante o download.`,
      buttons: ['Baixar', 'Agora não'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => {
      if (disposed || response !== 0) return undefined
      return startDownload()
    }).catch((error) => logger.warn('update', 'Não foi possível iniciar o download da atualização.', error))
      .finally(() => { promptingDownload = false })
  }
  const onProgress = (progress: ProgressInfo) => {
    const percent = Math.max(0, Math.min(100, progress.percent))
    setProgress(percent / 100)
    logger.debug('update', 'Download da atualização em andamento.', { percent: Math.round(percent) })
  }
  const onDownloaded = (info: UpdateInfo) => {
    if (disposed || promptingInstall) return
    downloadRequested = false
    setProgress(-1)
    promptingInstall = true
    void showMessage(getWindow(), {
      type: 'info',
      title: 'Atualização pronta',
      message: `Nocturne Studio ${info.version} foi baixado e verificado.`,
      detail: 'Reinicie agora para instalar. Se preferir, a atualização será aplicada quando você encerrar o aplicativo.',
      buttons: ['Reiniciar e instalar', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => { if (!disposed && response === 0) updater.quitAndInstall() })
      .catch((error) => logger.warn('update', 'Não foi possível exibir a confirmação da atualização.', error))
      .finally(() => { promptingInstall = false })
  }
  const onError = (error: Error) => {
    if (downloadRequested) {
      void handleDownloadFailure(error)
      return
    }
    logger.warn('update', 'Falha no serviço de atualização.', error)
  }

  updater.on('update-available', onAvailable)
  updater.on('download-progress', onProgress)
  updater.on('update-downloaded', onDownloaded)
  updater.on('error', onError)
  const initialCheck = setTimeout(check, CHECK_DELAY_MS)
  const recurringCheck = setInterval(check, CHECK_INTERVAL_MS)

  return () => {
    disposed = true
    setProgress(-1)
    clearTimeout(initialCheck)
    clearInterval(recurringCheck)
    updater.removeListener('update-available', onAvailable)
    updater.removeListener('download-progress', onProgress)
    updater.removeListener('update-downloaded', onDownloaded)
    updater.removeListener('error', onError)
  }
}

function formatReleaseNotes(notes: UpdateInfo['releaseNotes']) {
  const content = Array.isArray(notes)
    ? notes.map((entry) => entry.note ?? '').join('\n')
    : notes ?? ''
  return String(content)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2_000)
}

function getAutoUpdater(): AppUpdater {
  return electronUpdater.autoUpdater
}

function showMessage(window: BrowserWindow | null, options: Electron.MessageBoxOptions) {
  return window && !window.isDestroyed() ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
}
