import fs from 'node:fs'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory = 'app' | 'codex' | 'ipc' | 'workspace' | 'git' | 'artifacts' | 'export' | 'persistence'

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
    const entry = { timestamp: new Date().toISOString(), level, category, message: redact(message), data: redactValue(data) }
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
function redact(value: string) { return value.replace(/(token|authorization|api[_-]?key|password)(\s*[=:]\s*)\S+/gi, '$1$2[REDACTED]').slice(0, 8_000) }
function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !/token|authorization|api.?key|password/i.test(key)).map(([key, item]) => [key, redactValue(item)]))
  return value
}
