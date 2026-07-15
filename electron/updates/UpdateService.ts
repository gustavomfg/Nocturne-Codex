import { app, BrowserWindow, dialog } from 'electron'
import electronUpdater, { type AppUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { Logger } from '../logging/Logger'

const CHECK_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

export function startUpdateService(logger: Logger, getWindow: () => BrowserWindow | null): () => void {
  if (!app.isPackaged || process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT) return () => undefined

  const updater = getAutoUpdater()
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.logger = {
    debug: (message) => logger.debug('update', String(message)),
    info: (message) => logger.info('update', String(message)),
    warn: (message) => logger.warn('update', String(message)),
    error: (message) => logger.error('update', String(message)),
  }

  const check = () => updater.checkForUpdates().catch((error) => logger.warn('update', 'Não foi possível consultar atualizações.', error))
  const onAvailable = (info: UpdateInfo) => {
    void showMessage(getWindow(), {
      type: 'info',
      title: 'Atualização disponível',
      message: `Nocturne Codex ${info.version} está disponível.`,
      detail: 'Deseja baixar a atualização agora? Você poderá continuar usando o aplicativo durante o download.',
      buttons: ['Baixar', 'Agora não'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) return updater.downloadUpdate()
      return undefined
    }).catch((error) => logger.warn('update', 'Não foi possível iniciar o download da atualização.', error))
  }
  const onProgress = (progress: ProgressInfo) => logger.debug('update', 'Download da atualização em andamento.', { percent: Math.round(progress.percent) })
  const onDownloaded = (info: UpdateInfo) => {
    void showMessage(getWindow(), {
      type: 'info',
      title: 'Atualização pronta',
      message: `Nocturne Codex ${info.version} foi baixado e verificado.`,
      detail: 'Reinicie agora para instalar. Se preferir, a atualização será aplicada quando você encerrar o aplicativo.',
      buttons: ['Reiniciar e instalar', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => { if (response === 0) updater.quitAndInstall() })
      .catch((error) => logger.warn('update', 'Não foi possível exibir a confirmação da atualização.', error))
  }
  const onError = (error: Error) => logger.warn('update', 'Falha no serviço de atualização.', error)

  updater.on('update-available', onAvailable)
  updater.on('download-progress', onProgress)
  updater.on('update-downloaded', onDownloaded)
  updater.on('error', onError)
  const initialCheck = setTimeout(check, CHECK_DELAY_MS)
  const recurringCheck = setInterval(check, CHECK_INTERVAL_MS)

  return () => {
    clearTimeout(initialCheck)
    clearInterval(recurringCheck)
    updater.removeListener('update-available', onAvailable)
    updater.removeListener('download-progress', onProgress)
    updater.removeListener('update-downloaded', onDownloaded)
    updater.removeListener('error', onError)
  }
}

function getAutoUpdater(): AppUpdater {
  return electronUpdater.autoUpdater
}

function showMessage(window: BrowserWindow | null, options: Electron.MessageBoxOptions) {
  return window && !window.isDestroyed() ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
}
