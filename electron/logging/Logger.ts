import fs from 'node:fs'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory = 'app' | 'codex' | 'ai' | 'ipc' | 'workspace' | 'git' | 'artifacts' | 'export' | 'persistence' | 'update'

export class Logger {
  private readonly file: string
  private writes = Promise.resolve()
  constructor(private readonly directory: string, private diagnostic = false, private readonly maxBytes = 2_000_000) {
    fs.mkdirSync(directory, { recursive: true })
    this.file = path.join(directory, 'nocturne.log')
  }
  setDiagnostic(enabled: boolean) { this.diagnostic = enabled }
  debug(category: LogCategory, message: string, data?: unknown) { if (this.diagnostic) this.write('debug', category, message, data) }
  info(category: LogCategory, message: string, data?: unknown) { this.write('info', category, message, data) }
  warn(category: LogCategory, message: string, data?: unknown) { this.write('warn', category, message, data) }
  error(category: LogCategory, message: string, error?: unknown) { this.write('error', category, message, serializeError(error)) }
  get path() { return this.directory }
  private write(level: LogLevel, category: LogCategory, message: string, data?: unknown) {
    const entry = { timestamp: new Date().toISOString(), level, category, message: redactLogText(message), data: redactLogValue(data) }
    this.writes = this.writes.then(async () => { await this.rotate(); await fs.promises.appendFile(this.file, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 }) }).catch((error) => console.error('Falha ao gravar log do Nocturne:', error))
  }
  flush() { return this.writes }
  private async rotate() {
    try {
      if ((await fs.promises.stat(this.file)).size < this.maxBytes) return
      const backup = `${this.file}.1`
      await fs.promises.unlink(backup).catch(() => undefined)
      await fs.promises.rename(this.file, backup)
    } catch { /* file does not exist yet */ }
  }
}

function serializeError(error: unknown) { return error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error }
const SENSITIVE_KEYS = /(?:sk-[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/g
const SENSITIVE_FIELD_NAMES = /token|authorization|api[_-]?key|apikey|password|secret|credential|auth_token|refresh_token|access_token|client_secret/i
const SENSITIVE_HEADER = /\b(bearer|basic|digest|token)\s+[a-zA-Z0-9+/=_-]{8,}/gi
const JSON_SENSITIVE = new RegExp(`(["'])(?:${SENSITIVE_FIELD_NAMES.source})["']\\s*:\\s*["'](.*?)["']`, 'gi')
const KEY_VALUE_SENSITIVE = new RegExp(`\\b(${SENSITIVE_FIELD_NAMES.source})(\\s*[=:]\\s*)(["'])([^"']+)\\3`, 'gi')

export function redactLogText(value: string) {
  const jsonRedacted = value.replace(JSON_SENSITIVE, (_match, quote) => `${quote}[REDACTED]${quote}`)
  const headerRedacted = jsonRedacted.replace(SENSITIVE_HEADER, '$1 [REDACTED]')
  const kvRedacted = headerRedacted.replace(KEY_VALUE_SENSITIVE, '$1$2[REDACTED]')
  const keyRedacted = kvRedacted.replace(SENSITIVE_KEYS, '[REDACTED-KEY]')
  return keyRedacted.slice(0, 8_000)
}
export function redactLogValue(value: unknown): unknown {
  if (typeof value === 'string') return redactLogText(value)
  if (Array.isArray(value)) return value.map(redactLogValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !SENSITIVE_FIELD_NAMES.test(key)).map(([key, item]) => [key, redactLogValue(item)]))
  return value
}
