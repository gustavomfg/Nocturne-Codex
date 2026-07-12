import { dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import { Worker } from 'node:worker_threads'
import type { LocalDatabase } from '../database/Database'
import type { Logger } from '../logging/Logger'
import { backupSchema } from '../../shared/ipc/backupSchemas'
import { safeIpcMain } from './safeIpc'

export function registerDataIpc(win: BrowserWindow, database: LocalDatabase, logger: Logger) {
  const ipcMain = safeIpcMain(win)
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
    const stat = await fs.promises.stat(importPath)
    if (stat.size > 25_000_000) throw new Error('O backup excede o limite de 25 MB.')
    const parsed = await parseBackupInWorker(importPath)
    database.importData(backupSchema.parse(parsed))
    logger.info('persistence', 'Dados importados')
    return true
  })
}

function parseBackupInWorker(filePath: string) {
  return new Promise<unknown>((resolve, reject) => {
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); const fs = require('node:fs'); try { const value = JSON.parse(fs.readFileSync(workerData, 'utf8')); const keys = ['conversations','workspaces','messages','artifacts','memories','suggestions','suggestionDecisions']; const total = keys.reduce((sum, key) => sum + (Array.isArray(value[key]) ? value[key].length : 0), 0); if (total > 200000) throw new Error('O backup excede o limite agregado de 200.000 registros.'); parentPort.postMessage({ ok: true, value }); } catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }`, { eval: true, workerData: filePath })
    worker.once('message', (message: { ok: boolean; value?: unknown; error?: string }) => message.ok ? resolve(message.value) : reject(new Error(message.error || 'Backup inválido.')))
    worker.once('error', reject)
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Worker de importação encerrou com código ${code}.`)) })
  })
}
