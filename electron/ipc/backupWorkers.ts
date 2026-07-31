import { Worker } from 'node:worker_threads'
import { BACKUP_COLLECTION_KEYS, BACKUP_LIMITS } from '../../shared/ipc/backupLimits'

export const BACKUP_FILE_FORMAT = 'nocturne-studio-backup'
export const BACKUP_FILE_FORMAT_VERSION = 1

export function serializeBackupInWorker(value: unknown) {
  return new Promise<string>((resolve, reject) => {
    const workerData = { value, format: BACKUP_FILE_FORMAT, formatVersion: BACKUP_FILE_FORMAT_VERSION }
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); const { createHash } = require('node:crypto'); try { const canonical = JSON.stringify(workerData.value); const checksum = createHash('sha256').update(canonical).digest('hex'); const envelope = { format: workerData.format, formatVersion: workerData.formatVersion, integrity: { algorithm: 'sha256', checksum }, data: workerData.value }; parentPort.postMessage({ ok: true, value: JSON.stringify(envelope, null, 2) + '\\n' }); } catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }`, { eval: true, workerData })
    settleWorker(worker, (message) => message.ok && typeof message.value === 'string' ? resolve(message.value) : reject(new Error(message.error || 'Falha ao serializar backup.')), reject, 'exportação')
  })
}

export function parseBackupInWorker(filePath: string) {
  return new Promise<unknown>((resolve, reject) => {
    const workerData = { filePath, keys: BACKUP_COLLECTION_KEYS, maxRecords: BACKUP_LIMITS.maxRecords, format: BACKUP_FILE_FORMAT, formatVersion: BACKUP_FILE_FORMAT_VERSION }
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads'); const fs = require('node:fs'); const { createHash, timingSafeEqual } = require('node:crypto'); try { const root = JSON.parse(fs.readFileSync(workerData.filePath, 'utf8')); if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('A raiz do backup precisa ser um objeto.'); let value = root; if (Object.prototype.hasOwnProperty.call(root, 'format')) { const allowed = new Set(['format','formatVersion','integrity','data']); if (Object.keys(root).some((key) => !allowed.has(key)) || root.format !== workerData.format) throw new Error('Formato de backup inválido.'); if (root.formatVersion !== workerData.formatVersion) throw new Error('Versão do formato de backup incompatível.'); if (!root.integrity || root.integrity.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(root.integrity.checksum || '')) throw new Error('Metadados de integridade do backup são inválidos.'); const actual = createHash('sha256').update(JSON.stringify(root.data)).digest(); const expected = Buffer.from(root.integrity.checksum, 'hex'); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('O checksum do backup não confere; o arquivo pode estar corrompido ou ter sido alterado.'); value = root.data; } if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Os dados do backup precisam formar um objeto.'); for (const key of workerData.keys) if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error('Campo inválido no backup: ' + key); const total = workerData.keys.reduce((sum, key) => sum + (Array.isArray(value[key]) ? value[key].length : 0), 0); if (total > workerData.maxRecords) throw new Error('O backup excede o limite agregado de ' + new Intl.NumberFormat('pt-BR').format(workerData.maxRecords) + ' registros.'); parentPort.postMessage({ ok: true, value }); } catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }`, { eval: true, workerData })
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
