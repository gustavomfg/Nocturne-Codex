import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Logger } from '../electron/logging/Logger'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('Logger estruturado', () => {
  it('correlaciona a sessão sem persistir campos privados ou estruturas ilimitadas', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-logger-'))
    directories.push(directory)
    const logger = new Logger(directory, true)
    const circular: Record<string, unknown> = { safe: 'ok' }
    circular.self = circular
    logger.info('app', 'Evento operacional', { prompt: 'pedido privado', content: 'arquivo completo', token: 'segredo', circular })
    logger.debug('codex', 'Tráfego recebido', { stream: 'stdout', bytes: 42 })
    logger.error('app', 'Falha correlacionada', 'detalhe privado da falha')
    await logger.flush()

    const entries = fs.readFileSync(path.join(directory, 'nocturne.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(entries).toHaveLength(3)
    expect(new Set(entries.map((entry) => entry.sessionId)).size).toBe(1)
    expect(JSON.stringify(entries)).not.toMatch(/pedido privado|arquivo completo|segredo|detalhe privado/)
    expect(JSON.stringify(entries)).toContain('[CIRCULAR]')
    expect(logger.snapshot()).toMatchObject({ sessionId: entries[0].sessionId, diagnosticMode: true, entries: { debug: 1, info: 1, warn: 0, error: 1 } })
  })
})
