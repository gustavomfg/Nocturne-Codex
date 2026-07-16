import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUpdater, UpdateInfo } from 'electron-updater'
import type { Logger } from '../electron/logging/Logger'

const electron = vi.hoisted(() => ({
  responses: [] as number[],
  showMessageBox: vi.fn(async () => ({ response: electron.responses.shift() ?? 1 })),
}))

vi.mock('electron', () => ({
  app: { isPackaged: true },
  BrowserWindow: class {},
  dialog: { showMessageBox: electron.showMessageBox },
}))

vi.mock('electron-updater', () => ({ default: { autoUpdater: null } }))

import { startUpdateService } from '../electron/updates/UpdateService'

class FakeUpdater extends EventEmitter {
  autoDownload = true
  autoInstallOnAppQuit = false
  logger: unknown
  checkForUpdates = vi.fn(async () => null)
  downloadUpdate = vi.fn(async () => [])
  quitAndInstall = vi.fn()
}

const info = { version: '0.8.0' } as UpdateInfo
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger

describe('serviço de atualização', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    electron.responses.length = 0
    electron.showMessageBox.mockClear()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('consulta sem sobreposição e remove timers e listeners ao encerrar', async () => {
    const updater = new FakeUpdater()
    let finishCheck: (() => void) | undefined
    updater.checkForUpdates.mockImplementation(() => new Promise((resolve) => { finishCheck = () => resolve(null) }))
    const dispose = startUpdateService(logger, () => null, updater as unknown as AppUpdater)
    await vi.advanceTimersByTimeAsync(15_000)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1_000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    finishCheck?.(); await Promise.resolve()
    expect(updater.listenerCount('update-available')).toBe(1)
    dispose()
    expect(updater.listenerCount('update-available')).toBe(0)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1_000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('pede consentimento uma única vez para baixar e instalar', async () => {
    const updater = new FakeUpdater()
    electron.responses.push(0, 0)
    const dispose = startUpdateService(logger, () => null, updater as unknown as AppUpdater)
    updater.emit('update-available', info)
    updater.emit('update-available', info)
    await vi.advanceTimersByTimeAsync(0)
    expect(electron.showMessageBox).toHaveBeenCalledTimes(1)
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
    updater.emit('update-downloaded', info)
    updater.emit('update-downloaded', info)
    await vi.advanceTimersByTimeAsync(0)
    expect(electron.showMessageBox).toHaveBeenCalledTimes(2)
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('respeita a recusa e permite tentar novamente após falha de download', async () => {
    const updater = new FakeUpdater()
    electron.responses.push(1, 0, 0)
    const dispose = startUpdateService(logger, () => null, updater as unknown as AppUpdater)
    updater.emit('update-available', info)
    await vi.advanceTimersByTimeAsync(0)
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    updater.downloadUpdate.mockRejectedValueOnce(new Error('rede indisponível'))
    updater.emit('update-available', info)
    await vi.advanceTimersByTimeAsync(0)
    expect(logger.warn).toHaveBeenCalled()
    updater.emit('update-available', info)
    await vi.advanceTimersByTimeAsync(0)
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(2)
    dispose()
  })
})
