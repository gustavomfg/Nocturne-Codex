import { dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import type { LocalDatabase } from '../database/Database'
import type { Logger } from '../logging/Logger'
import { backupSchema } from '../../shared/ipc/backupSchemas'
import { assertBackupByteLimit, assertBackupRecordLimit } from '../../shared/ipc/backupLimits'
import { safeIpcMain } from './safeIpc'
import { parseBackupInWorker, serializeBackupInWorker } from './backupWorkers'

export function registerDataIpc(win: BrowserWindow, database: LocalDatabase, logger: Logger) {
  const ipcMain = safeIpcMain(win)
  ipcMain.handle('data:export', async () => {
    const result = await dialog.showSaveDialog(win, { title: 'Exportar dados do Nocturne', defaultPath: 'nocturne-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePath) return null
    const startedAt = performance.now()
    const exported = database.exportData()
    assertBackupRecordLimit(exported)
    const serialized = await serializeBackupInWorker(exported)
    assertBackupByteLimit(Buffer.byteLength(serialized, 'utf8'))
    await fs.promises.writeFile(result.filePath, serialized, { encoding: 'utf8', mode: 0o600 })
    logger.info('persistence', 'Dados exportados', { bytes: Buffer.byteLength(serialized), durationMs: Math.round(performance.now() - startedAt) })
    return result.filePath
  })
  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Importar dados do Nocturne', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePaths[0]) return false
    const importPath = result.filePaths[0]
    const stat = await fs.promises.stat(importPath)
    assertBackupByteLimit(stat.size)
    const parsed = await parseBackupInWorker(importPath)
    const validated = backupSchema.parse(parsed)
    const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Substituir dados'], defaultId: 0, cancelId: 0, title: 'Restaurar backup', message: 'Substituir todos os dados locais por este backup?', detail: 'Conversas, configurações, memórias e artefatos atuais serão substituídos. Exporte seus dados antes se quiser preservar uma cópia.' })
    if (confirmation.response !== 1) return false
    const recoveryPath = await database.createRecoverySnapshot()
    database.importData(validated)
    logger.info('persistence', 'Dados importados', { recoveryPath })
    return true
  })
  return () => ipcMain.dispose()
}
