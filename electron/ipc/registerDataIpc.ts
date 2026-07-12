import { dialog, ipcMain, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import type { LocalDatabase } from '../database/Database'
import type { Logger } from '../logging/Logger'
import { backupSchema } from '../../shared/ipc/backupSchemas'

export function registerDataIpc(win: BrowserWindow, database: LocalDatabase, logger: Logger) {
  ipcMain.handle('data:export', async () => {
    const result = await dialog.showSaveDialog(win, { title: 'Exportar dados do Nocturne', defaultPath: 'nocturne-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, `${JSON.stringify(database.exportData(), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    logger.info('persistence', 'Dados exportados')
    return result.filePath
  })
  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Importar dados do Nocturne', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePaths[0]) return false
    const importPath = result.filePaths[0]
    if (fs.statSync(importPath).size > 100_000_000) throw new Error('O backup excede o limite de 100 MB.')
    database.importData(backupSchema.parse(JSON.parse(fs.readFileSync(importPath, 'utf8'))))
    logger.info('persistence', 'Dados importados')
    return true
  })
}
