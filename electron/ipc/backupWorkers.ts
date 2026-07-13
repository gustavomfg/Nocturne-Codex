import { Worker } from 'node:worker_threads'
import { BACKUP_COLLECTION_KEYS, BACKUP_LIMITS } from '../../shared/ipc/backupLimits'

export function serializeBackupInWorker(value: unknown) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); try { parentPort.postMessage({ ok: true, value: JSON.stringify(workerData, null, 2) + '\\n' }); } catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }`, { eval: true, workerData: value })
    settleWorker(worker, (message) => message.ok && typeof message.value === 'string' ? resolve(message.value) : reject(new Error(message.error || 'Falha ao serializar backup.')), reject, 'exportação')
  })
}

export function parseBackupInWorker(filePath: string) {
  return new Promise<unknown>((resolve, reject) => {
    const workerData = { filePath, keys: BACKUP_COLLECTION_KEYS, maxRecords: BACKUP_LIMITS.maxRecords }
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); const fs = require('node:fs'); try { const value = JSON.parse(fs.readFileSync(workerData.filePath, 'utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A raiz do backup precisa ser um objeto.'); for (const key of workerData.keys) if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error('Campo inválido no backup: ' + key); const total = workerData.keys.reduce((sum, key) => sum + (Array.isArray(value[key]) ? value[key].length : 0), 0); if (total > workerData.maxRecords) throw new Error('O backup excede o limite agregado de ' + new Intl.NumberFormat('pt-BR').format(workerData.maxRecords) + ' registros.'); parentPort.postMessage({ ok: true, value }); } catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }`, { eval: true, workerData })
    settleWorker(worker, (message) => message.ok ? resolve(message.value) : reject(new Error(message.error || 'Backup inválido.')), reject, 'importação')
  })
}

interface WorkerResult { ok: boolean; value?: unknown; error?: string }

function settleWorker(worker: Worker, onMessage: (message: WorkerResult) => void, reject: (error: Error) => void, operation: string) {
  let settled = false
  worker.once('message', (message: WorkerResult) => { settled = true; onMessage(message) })
  worker.once('error', (error) => { settled = true; reject(error) })
  worker.once('exit', (code) => { if (!settled && code !== 0) reject(new Error(`Worker de ${operation} encerrou com código ${code}.`)) })
}
