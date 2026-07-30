import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceChangeWatcher } from '../electron/workspaces/WorkspaceChangeWatcher'

interface FakeWatchHandle {
  close(): void
  on(event: 'error', listener: (error: Error) => void): this
}

describe('monitoramento de mudanças no workspace', () => {
  afterEach(() => vi.useRealTimers())

  it('agrupa caminhos, ignora diretórios gerados e limita o lote', () => {
    vi.useFakeTimers()
    const emitted = vi.fn()
    const captured: { listener: ((eventType: string, filename: string | null) => void) | null } = { listener: null }
    const close = vi.fn()
    const handle: FakeWatchHandle = {
      close,
      on: vi.fn(() => handle),
    }
    const watcher = new WorkspaceChangeWatcher(emitted, (_workspace, _options, nextListener) => {
      captured.listener = nextListener
      return handle
    }, 50)
    watcher.start('/tmp/nocturne-watched-project')

    captured.listener?.('change', 'src/App.tsx')
    captured.listener?.('rename', 'src/App.tsx')
    captured.listener?.('change', '.nocturne/memory.md')
    captured.listener?.('change', 'node_modules/package/index.js')
    for (let index = 0; index < 105; index += 1) captured.listener?.('change', `src/file-${index}.ts`)
    vi.advanceTimersByTime(50)

    expect(emitted).toHaveBeenCalledOnce()
    expect(emitted.mock.calls[0][0]).toMatchObject({
      workspace: '/tmp/nocturne-watched-project',
      paths: expect.arrayContaining(['.nocturne/memory.md', 'src/App.tsx']),
      overflow: true,
    })
    expect(emitted.mock.calls[0][0].paths).toHaveLength(100)
    expect(emitted.mock.calls[0][0].paths).not.toContain('node_modules/package/index.js')
    watcher.stop()
    expect(close).toHaveBeenCalledOnce()
  })

  it('encerra deterministicamente quando o observador nativo falha', () => {
    const emitted = vi.fn()
    const captured: { errorListener: ((error: Error) => void) | null } = { errorListener: null }
    const close = vi.fn()
    const handle: FakeWatchHandle = {
      close,
      on: vi.fn((_event, listener) => {
        captured.errorListener = listener
        return handle
      }),
    }
    const watcher = new WorkspaceChangeWatcher(emitted, () => handle)
    watcher.start('/tmp/nocturne-watched-project')

    captured.errorListener?.(new Error('limite do sistema'))

    expect(emitted).toHaveBeenCalledWith(expect.objectContaining({
      workspace: '/tmp/nocturne-watched-project',
      paths: [],
      error: 'Monitoramento interrompido: limite do sistema',
    }))
    expect(close).toHaveBeenCalledOnce()
  })
})
