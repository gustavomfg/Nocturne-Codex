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
    const validated = backupSchema.parse(parsed)
    const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Substituir dados'], defaultId: 0, cancelId: 0, title: 'Restaurar backup', message: 'Substituir todos os dados locais por este backup?', detail: 'Conversas, configurações, memórias e artefatos atuais serão substituídos. Exporte seus dados antes se quiser preservar uma cópia.' })
    if (confirmation.response !== 1) return false
    database.importData(validated)
    logger.info('persistence', 'Dados importados')
    return true
  })
}

function parseBackupInWorker(filePath: string) {
  return new Promise<unknown>((resolve, reject) => {
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); const fs = require('node:fs'); try { const value = JSON.parse(fs.readFileSync(workerData, 'utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A raiz do backup precisa ser um objeto.'); const keys = ['conversations','workspaces','messages','artifacts','memories','suggestions','suggestionDecisions']; for (const key of keys) if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error('Campo inválido no backup: ' + key); const total = keys.reduce((sum, key) => sum + (Array.isArray(value[key]) ? value[key].length : 0), 0); if (total > 50000) throw new Error('O backup excede o limite agregado de 50.000 registros.'); parentPort.postMessage({ ok: true, value }); } catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }`, { eval: true, workerData: filePath })
    worker.once('message', (message: { ok: boolean; value?: unknown; error?: string }) => message.ok ? resolve(message.value) : reject(new Error(message.error || 'Backup inválido.')))
    worker.once('error', reject)
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Worker de importação encerrou com código ${code}.`)) })
  })
}
