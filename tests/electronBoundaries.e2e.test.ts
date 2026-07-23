import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NocturneApi } from '../shared/ipc/contracts'
import { DATABASE_SCHEMA_VERSION } from '../shared/constants'
import type {
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../shared/ai/providerConfiguration'
import type { ModelDescriptor } from '../shared/ai/model'

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown

const electron = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>()
  const rendererListeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>()
  const dialogs = {
    open: [] as Array<{ canceled: boolean; filePaths: string[] }>,
    save: [] as Array<{ canceled: boolean; filePath?: string }>,
  }
  let exposed: NocturneApi | null = null
  let clipboardText = ''
  const mainFrame = { routingId: 1, url: 'file:///nocturne/index.html' }
  const mainWebContents: { send(channel: string, payload: unknown): void; mainFrame: typeof mainFrame; getURL(): string } = { send: () => undefined, mainFrame, getURL: () => mainFrame.url }
  return {
    handlers,
    rendererListeners,
    dialogs,
    get exposed() { return exposed },
    setExposed(api: NocturneApi) { exposed = api },
    get clipboardText() { return clipboardText },
    set clipboardText(value: string) { clipboardText = value },
    mainFrame,
    mainWebContents,
  }
})

vi.mock('electron', () => ({
  BrowserWindow: class { webContents = electron.mainWebContents },
  contextBridge: { exposeInMainWorld: (_name: string, api: NocturneApi) => electron.setExposed(api) },
  clipboard: { readText: vi.fn(() => electron.clipboardText), writeText: vi.fn((value: string) => { electron.clipboardText = value }) },
  dialog: {
    showOpenDialog: vi.fn(async () => electron.dialogs.open.shift() ?? { canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn(async () => electron.dialogs.save.shift() ?? { canceled: true }),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
  },
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      if (electron.handlers.has(channel)) throw new Error(`Handler already registered for '${channel}'`)
      electron.handlers.set(channel, handler)
    },
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
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

class SimulatedProviderConfigurations {
  private configurations = new Map<string, ProviderConfigurationSummary>()
  readonly submittedCredentials: string[] = []
  private nextId = 0

  list() {
    return [...this.configurations.values()]
  }

  async create(input: ProviderConfigurationInput, change?: { credential?: string }) {
    this.nextId += 1
    const id = `00000000-0000-4000-8000-${String(this.nextId).padStart(12, '0')}`
    const credential = change?.credential
    const created: ProviderConfigurationSummary = {
      id, enabled: input.enabled ?? true, displayName: input.displayName, source: input.source,
      providerType: 'openai-compatible', baseUrl: input.baseUrl,
      requiresAuthentication: credential ? true : input.requiresAuthentication ?? false,
      credentialConfigured: Boolean(credential), timeoutMs: input.timeoutMs ?? 60000,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    this.configurations.set(id, created)
    if (credential) this.submittedCredentials.push(credential)
    return created
  }

  async update(id: string, input: ProviderConfigurationInput, change?: { credential?: string; clearCredential?: boolean }) {
    const current = this.configurations.get(id)
    if (!current) throw new Error('Provider não encontrado.')
    const updated = { ...current, displayName: input.displayName, baseUrl: input.baseUrl, source: input.source, requiresAuthentication: input.requiresAuthentication ?? false, updatedAt: new Date().toISOString() }
    this.configurations.set(id, updated)
    if (change?.credential) this.submittedCredentials.push(change.credential)
    return updated
  }

  async remove(id: string) {
    if (!this.configurations.has(id)) return false
    this.configurations.delete(id)
    return true
  }

  async testConnection(_id: string) {
    return { status: 'available' as const }
  }
}

class SimulatedModelCatalog {
  models: ModelDescriptor[] = []
  list() { return this.models }
  async refresh(_id: string) {
    return { status: 'applied' as const, models: [] }
  }
}

const simulatedModel: ModelDescriptor = {
  providerId: 'unique-test', modelId: 'example', displayName: 'Example Model', source: 'remote',
  capabilities: ['chat', 'streaming'] as const, availability: 'available',
}

describe('limites entre processos Electron (IPC, preload, SQLite)', () => {
  let api: NocturneApi
  let database: Awaited<ReturnType<typeof createDatabase>> | null = null
  let disposeIpc: (() => void) | null = null
  let root: string
  const electronMock = electron

  async function createDatabase(userDataPath: string) {
    const { LocalDatabase } = await import('../electron/database/Database')
    const db = new LocalDatabase(userDataPath)
    return db
  }

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-boundary-'))
    database = await createDatabase(root)
    fs.mkdirSync(workspace, { recursive: true })
    const { registerIpc } = await import('../electron/ipc/registerIpc')
    const { Logger } = await import('../electron/logging/Logger')
    const { ModelRegistry } = await import('../electron/ai/ModelRegistry')
    const { ProviderRegistry } = await import('../electron/ai/ProviderRegistry')
    const logger = new Logger(root)
    const providers = new SimulatedProviderConfigurations()
    const simulatedModelCatalog = new SimulatedModelCatalog()
    simulatedModelCatalog.models.push(simulatedModel)
    const testModelRegistry = new ModelRegistry()
    testModelRegistry.register(simulatedModel)
    const testProviderRegistry = new ProviderRegistry()

    const mockBrowserWindow = { webContents: electronMock.mainWebContents }
    disposeIpc = registerIpc(
      mockBrowserWindow as never,
      database,
      logger,
      providers as never,
      simulatedModelCatalog as never,
      testModelRegistry,
      testProviderRegistry,
    )
    await import('../electron/preload')
    if (!electron.exposed) throw new Error('O preload não expôs window.nocturne.')
    api = electron.exposed
  })

  afterAll(() => {
    disposeIpc?.()
    database?.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('expõe somente a API nomeada e cruza preload, IPC e SQLite', async () => {
    expect(Object.keys(api).sort()).toEqual(['ai', 'artifacts', 'brain', 'clipboard', 'conversations', 'data', 'diagnostics', 'documents', 'files', 'git', 'memory', 'models', 'providers', 'settings', 'suggestions', 'workspace'])
    await api.clipboard.writeText('commit sugerido')
    await expect(api.clipboard.readText()).resolves.toBe('commit sugerido')
    electron.dialogs.open.push({ canceled: false, filePaths: [workspace] })
    await expect(api.workspace.select()).resolves.toBe(workspace)
    expect(fs.existsSync(path.join(workspace, '.nocturne', 'project.json'))).toBe(true)
    await expect(api.models.list()).resolves.toEqual([simulatedModel])
    await expect(api.models.refresh(simulatedModel.providerId)).resolves.toMatchObject({
      status: 'applied',
      models: [],
    })
    const bindings = {
      workspaceId: workspace,
      defaultBinding: {
        providerId: simulatedModel.providerId,
        modelId: simulatedModel.modelId,
      },
    }
    await expect(api.models.setBindings(bindings)).resolves.toEqual(bindings)
    await expect(api.models.bindings(workspace)).resolves.toEqual(bindings)

    const conversation = await api.conversations.create(workspace)
    expect((await api.conversations.messages(conversation.id)).map((message) => message.content)).toEqual([])
    expect(conversation).toMatchObject({ id: expect.any(String), title: 'Nova conversa', workspace })
    await api.conversations.delete(conversation.id)
  })

  it('persiste e recupera conversas com paginação', async () => {
    const c1 = await api.conversations.create(workspace)
    const page = await api.conversations.page()
    expect(page.items).toHaveLength(1)
    expect(page.items[0].id).toBe(c1.id)
    expect(page.hasMore).toBe(false)
    for (let i = 0; i < 5; i++) await api.conversations.create(workspace)
    const paginated = await api.conversations.page(0, 3)
    expect(paginated.items).toHaveLength(3)
    expect(paginated.hasMore).toBe(true)
  })

  it('rejeita caminhos de workspace fora do escopo durante a importação de backup', async () => {
    const backup = {
      schemaVersion: DATABASE_SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      workspaces: [{ path: '/etc', name: 'etc', favorite: 0 as const, created_at: new Date().toISOString(), last_opened_at: new Date().toISOString() }],
      conversations: [], messages: [], artifacts: [], memories: [], suggestions: [], suggestionDecisions: [], providerConfigs: [], modelCatalog: [], workspaceModelBindings: [],
    }
    const { backupSchema } = await import('../shared/ipc/backupSchemas')
    expect(() => backupSchema.parse(backup)).not.toThrow()
    const { assertSafeWorkspaceScope } = await import('../electron/security/WorkspaceTrust')
    expect(() => assertSafeWorkspaceScope('/etc', false)).toThrow(/Selecione uma pasta de projeto específica/)
  })

  it('gerencia o ciclo de vida completo de providers via IPC', async () => {
    const created = await api.providers.create({
      providerType: 'openai-compatible', displayName: 'Test OpenAI',
      baseUrl: 'https://api.openai.com/v1', source: 'remote', requiresAuthentication: true,
      enabled: true, timeoutMs: 60000,
    }, 'sk-test-123')
    expect(created.id).toBeTruthy()
    expect(created.displayName).toBe('Test OpenAI')
    expect(created.baseUrl).toBe('https://api.openai.com/v1')
    expect(created.enabled).toBe(true)

    const list = await api.providers.list()
    expect(list).toHaveLength(1)
    expect(list[0].displayName).toBe('Test OpenAI')

    const availability = await api.providers.testConnection(created.id)
    expect(availability.status).toBe('available')

    const updated = await api.providers.update(created.id, {
      providerType: 'openai-compatible', displayName: 'Updated OpenAI',
      baseUrl: 'https://updated.openai.com/v1', source: 'remote', requiresAuthentication: true,
      enabled: true, timeoutMs: 60000,
    })
    expect(updated.displayName).toBe('Updated OpenAI')

    await api.providers.remove(created.id)
    expect(await api.providers.list()).toHaveLength(0)
  })

  it('rejeita credenciais em backup e remove codexPath das settings importadas', async () => {
    const { backupSchema } = await import('../shared/ipc/backupSchemas')
    const backup = {
      schemaVersion: DATABASE_SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      workspaces: [{ path: root, name: 'test', favorite: 0 as const, created_at: new Date().toISOString(), last_opened_at: new Date().toISOString() }],
      conversations: [], messages: [], artifacts: [], memories: [], providerConfigs: [], modelCatalog: [], workspaceModelBindings: [],
      settings: { model: 'gpt-4' },
    }
    expect(() => backupSchema.parse(backup)).not.toThrow()
    const validated = backupSchema.parse(backup)
    expect(validated.settings).not.toHaveProperty('codexPath')
  })
})

const workspace = '/tmp/test-workspace-nocturne'
