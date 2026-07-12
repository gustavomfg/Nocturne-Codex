import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NocturneApi } from '../shared/ipc/contracts'

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown

const electron = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>()
  const rendererListeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>()
  const dialogs = {
    open: [] as Array<{ canceled: boolean; filePaths: string[] }>,
    save: [] as Array<{ canceled: boolean; filePath?: string }>,
  }
  let exposed: NocturneApi | null = null
  const mainFrame = { routingId: 1, url: 'file:///nocturne/index.html' }
  const mainWebContents: { send(channel: string, payload: unknown): void; mainFrame: typeof mainFrame; getURL(): string } = { send: () => undefined, mainFrame, getURL: () => mainFrame.url }
  return {
    handlers,
    rendererListeners,
    dialogs,
    get exposed() { return exposed },
    setExposed(api: NocturneApi) { exposed = api },
    mainFrame,
    mainWebContents,
  }
})

vi.mock('electron', () => ({
  BrowserWindow: class {},
  contextBridge: { exposeInMainWorld: (_name: string, api: NocturneApi) => electron.setExposed(api) },
  dialog: {
    showOpenDialog: vi.fn(async () => electron.dialogs.open.shift() ?? { canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn(async () => electron.dialogs.save.shift() ?? { canceled: true }),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
  },
  ipcMain: { handle: (channel: string, handler: IpcHandler) => electron.handlers.set(channel, handler) },
  ipcRenderer: {
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = electron.handlers.get(channel)
      if (!handler) throw new Error(`Handler IPC ausente: ${channel}`)
      return handler({ sender: electron.mainWebContents, senderFrame: electron.mainFrame }, ...args)
    },
    on: (channel: string, listener: (event: unknown, payload: unknown) => void) => {
      const listeners = electron.rendererListeners.get(channel) ?? new Set()
      listeners.add(listener)
      electron.rendererListeners.set(channel, listeners)
    },
    removeListener: (channel: string, listener: (event: unknown, payload: unknown) => void) => electron.rendererListeners.get(channel)?.delete(listener),
  },
  shell: { openPath: vi.fn(async () => ''), showItemInFolder: vi.fn(), openExternal: vi.fn(async () => undefined) },
}))

class SimulatedCodex extends EventEmitter {
  status = 'ready'
  createdThreads: string[] = []
  resumedThreads: string[] = []
  turns: Array<{ threadId: string; prompt: string }> = []
  interruptions: string[] = []
  approvals: Array<{ key: string; accepted: boolean; forSession: boolean }> = []
  restarts = 0

  async start() { this.status = 'ready' }
  async restart() { this.restarts += 1; this.status = 'ready' }
  getDiagnostics() { return { executable: 'simulated-codex', pid: 42, state: this.status } }
  async createThread() { const id = `thread-${this.createdThreads.length + 1}`; this.createdThreads.push(id); return id }
  async resumeThread(threadId: string) { this.resumedThreads.push(threadId) }
  async sendTurn(threadId: string, _workspace: string, prompt: string) { this.turns.push({ threadId, prompt }); return { id: `turn-${this.turns.length}` } }
  async interrupt(threadId: string) { this.interruptions.push(threadId) }
  async resolveApproval(key: string, accepted: boolean, forSession = false) { this.approvals.push({ key, accepted, forSession }) }
  async readConfig() { return {} }
}

describe.sequential('fronteiras Electron E2E', () => {
  let root: string
  let workspace: string
  let outside: string
  let backupPath: string
  let api: NocturneApi
  let database: import('../electron/database/Database').LocalDatabase
  let codex: SimulatedCodex

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-electron-e2e-'))
    workspace = path.join(root, 'workspace')
    outside = path.join(root, 'outside')
    backupPath = path.join(root, 'backup.json')
    fs.mkdirSync(workspace)
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(workspace, 'inside.md'), '# interno\n')
    fs.writeFileSync(path.join(outside, 'secret.md'), '# segredo\n')
    fs.symlinkSync(outside, path.join(workspace, 'escape'))

    const [{ LocalDatabase }, { Logger }, { registerIpc }] = await Promise.all([
      import('../electron/database/Database'),
      import('../electron/logging/Logger'),
      import('../electron/ipc/registerIpc'),
    ])
    const dataDirectory = path.join(root, 'data')
    fs.mkdirSync(dataDirectory)
    database = new LocalDatabase(dataDirectory)
    codex = new SimulatedCodex()
    const sent = (channel: string, payload: unknown) => {
      for (const listener of electron.rendererListeners.get(channel) ?? []) listener({}, payload)
    }
    electron.mainWebContents.send = sent
    const win = { isDestroyed: () => false, webContents: electron.mainWebContents }
    const logger = new Logger(path.join(root, 'test-output'))
    registerIpc(win as never, database, codex as never, logger)
    await import('../electron/preload')
    if (!electron.exposed) throw new Error('O preload não expôs window.nocturne.')
    api = electron.exposed
  })

  afterAll(() => {
    database?.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('expõe somente a API nomeada e cruza preload, IPC e SQLite', async () => {
    expect(Object.keys(api).sort()).toEqual(['artifacts', 'codex', 'conversations', 'data', 'diagnostics', 'documents', 'files', 'git', 'memory', 'settings', 'suggestions', 'workspace'])
    electron.dialogs.open.push({ canceled: false, filePaths: [workspace] })
    await expect(api.workspace.select()).resolves.toBe(workspace)
    expect(fs.existsSync(path.join(workspace, '.nocturne', 'project.json'))).toBe(true)

    const conversation = await api.conversations.create(workspace)
    await api.codex.send(conversation.id, 'Primeiro turno')
    await api.codex.send(conversation.id, 'Retomar thread')
    await api.codex.resume(conversation.id)
    await api.codex.interrupt(conversation.id)

    expect(codex.createdThreads).toEqual(['thread-1'])
    expect(codex.resumedThreads).toContain('thread-1')
    expect(codex.turns.map((turn) => turn.prompt)).toEqual(['Primeiro turno', 'Retomar thread'])
    expect(codex.interruptions).toEqual(['thread-1'])
    expect((await api.conversations.messages(conversation.id)).map((message) => message.content)).toEqual(['Primeiro turno', 'Retomar thread'])
  })

  it('rejeita chamadas IPC de outro WebContents ou frame', async () => {
    const handler = electron.handlers.get('conversations:list')
    expect(handler).toBeDefined()
    await expect(Promise.resolve().then(() => handler?.({ sender: {}, senderFrame: electron.mainFrame }))).rejects.toThrow(/Origem IPC não autorizada/)
    await expect(Promise.resolve().then(() => handler?.({ sender: electron.mainWebContents, senderFrame: {} }))).rejects.toThrow(/Origem IPC não autorizada/)
  })

  it('encaminha queda, restart, aprovação e recusa entre processo principal e preload', async () => {
    const statuses: unknown[] = []
    const unsubscribe = api.codex.onStatus((status) => statuses.push(status))
    codex.emit('status', { status: 'failed', error: 'processo simulado encerrado' })
    expect(statuses).toEqual([{ status: 'failed', error: 'processo simulado encerrado' }])
    unsubscribe()

    codex.emit('event', { method: 'item/commandExecution/requestApproval', params: { approvalKey: 'approve-1', command: ['npm', 'test'] } })
    await api.codex.approve('approve-1', true, true)
    codex.emit('event', { method: 'item/fileChange/requestApproval', params: { approvalKey: 'decline-1', command: ['rm', '-rf', 'build'] } })
    await api.codex.approve('decline-1', false)
    await api.codex.restart()

    expect(codex.approvals).toEqual([
      { key: 'approve-1', accepted: true, forSession: true },
      { key: 'decline-1', accepted: false, forSession: false },
    ])
    expect(codex.restarts).toBe(1)
  })

  it('exporta e restaura o backup atravessando diálogos e IPC', async () => {
    electron.dialogs.save.push({ canceled: false, filePath: backupPath })
    await expect(api.data.export()).resolves.toBe(backupPath)
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as { schemaVersion: number; conversations: unknown[]; messages: unknown[] }
    expect(backup.schemaVersion).toBe(5)
    expect(backup.conversations.length).toBeGreaterThan(0)
    expect(backup.messages.length).toBeGreaterThan(0)

    electron.dialogs.open.push({ canceled: false, filePaths: [backupPath] })
    await expect(api.data.import()).resolves.toBe(true)
  })

  it('permite preview interno e bloqueia traversal e symlink através do IPC', async () => {
    const conversation = (await api.conversations.list())[0]
    await expect(api.files.preview(conversation.id, path.join(workspace, 'inside.md'))).resolves.toMatchObject({ kind: 'markdown', content: '# interno\n' })
    await expect(api.files.preview(conversation.id, '../outside/secret.md')).rejects.toThrow(/fora do workspace/)
    await expect(api.files.preview(conversation.id, path.join(workspace, 'escape', 'secret.md'))).rejects.toThrow(/fora do workspace/)
  })
})
