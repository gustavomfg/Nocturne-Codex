import type { Page } from '@playwright/test'

export async function installNocturneMock(page: Page, options: { empty?: boolean; unauthorized?: boolean } = {}) {
  await page.addInitScript(({ empty, unauthorized }) => {
    localStorage.setItem('nocturne.onboarding.completed', 'true')
    const now = '2026-07-13T20:00:00.000Z'
    const workspace = '/workspace/nocturne-codex'
    const conversation = { id: 'conversation-1', title: 'Lapidação da experiência', workspace, codexThreadId: 'thread-1', createdAt: now, updatedAt: now }
    const eventListeners: Array<(payload: unknown) => void> = []
    const statusListeners: Array<(payload: unknown) => void> = []
    let authorized = !unauthorized
    let selectedExpected: string | undefined
    let memoryReads = 0
    let resumes = 0
    type MockBrainMemory = { id: string; workspaceId: string; conversationId: string | null; kind: 'fact' | 'decision' | 'preference' | 'constraint' | 'learning'; scope: 'workspace' | 'conversation'; status: 'candidate' | 'active' | 'outdated' | 'archived'; content: string; confidence: number; sourceType: 'manual' | 'agent'; sourceId: string | null; createdAt: string; updatedAt: string; lastConfirmedAt: string | null; lastUsedAt: string | null; useCount: number }
    let brainMemories: MockBrainMemory[] = []
    const noop = async () => undefined
    const api = {
      workspace: { select: async (expected?: string) => { selectedExpected = expected; authorized = true; return workspace }, validate: async () => true, list: async () => [{ path: workspace, name: 'nocturne-codex', favorite: true, authorized, createdAt: now, lastOpenedAt: now }], remove: noop, favorite: noop, openTool: noop },
      conversations: {
        list: async () => empty ? [] : [conversation],
        page: async () => ({ items: empty ? [] : [conversation], hasMore: false }),
        create: async () => conversation,
        messages: async () => empty ? [] : [
          { id: 'message-1', conversationId: conversation.id, role: 'user', content: 'Deixe a experiência mais fluida e previsível.', metadata: null, createdAt: now },
          { id: 'message-2', conversationId: conversation.id, role: 'assistant', content: 'A interface foi analisada. Os fluxos prioritários estão organizados e prontos para validação.', metadata: null, createdAt: now },
        ],
        messagePage: async () => ({ items: empty ? [] : [
          { id: 'message-1', conversationId: conversation.id, role: 'user', content: 'Deixe a experiência mais fluida e previsível.', metadata: null, createdAt: now },
          { id: 'message-2', conversationId: conversation.id, role: 'assistant', content: 'A interface foi analisada. Os fluxos prioritários estão organizados e prontos para validação.', metadata: null, createdAt: now },
        ], hasMore: false }),
        delete: noop,
      },
      codex: {
        start: noop, restart: noop, diagnostics: async () => ({ executable: 'codex', pid: 42, state: 'ready', lastFailure: null, logsPath: '/tmp/nocturne' }), send: noop, resume: async () => { resumes += 1 }, interrupt: noop,
        saveAssistant: async (conversationId: string, content: string) => ({ id: 'saved-message', conversationId, role: 'assistant', content, metadata: null, createdAt: now }), approve: noop,
        onEvent: (listener: (payload: unknown) => void) => { eventListeners.push(listener); return () => { const index = eventListeners.indexOf(listener); if (index >= 0) eventListeners.splice(index, 1) } },
        onStatus: (listener: (payload: unknown) => void) => { statusListeners.push(listener); return () => { const index = statusListeners.indexOf(listener); if (index >= 0) statusListeners.splice(index, 1) } },
      },
      files: { attach: async () => [], open: noop, preview: async (_id: string, filePath: string) => ({ kind: 'text', name: filePath.split('/').pop(), filePath, mime: 'text/plain', content: 'conteúdo', size: 8 }) },
      memory: { get: async () => { memoryReads += 1; return { content: '', rules: '', updatedAt: '' } }, set: async (_id: string, content: string, rules: string) => ({ content, rules, updatedAt: now }) },
      brain: {
        page: async (_id: string, offset = 0, limit = 50, query = '', status?: MockBrainMemory['status']) => {
          const normalized = query.toLocaleLowerCase()
          const filtered = brainMemories.filter((item) => (!status || item.status === status) && (!normalized || item.content.toLocaleLowerCase().includes(normalized)))
          return { items: filtered.slice(offset, offset + limit), hasMore: filtered.length > offset + limit }
        },
        create: async (_id: string, value: Pick<MockBrainMemory, 'kind' | 'scope' | 'content'>) => {
          const memory: MockBrainMemory = { id: `brain-${brainMemories.length + 1}`, workspaceId: workspace, conversationId: value.scope === 'conversation' ? conversation.id : null, ...value, status: 'candidate', confidence: 70, sourceType: 'manual', sourceId: null, createdAt: now, updatedAt: now, lastConfirmedAt: null, lastUsedAt: null, useCount: 0 }
          brainMemories = [memory, ...brainMemories]; return memory
        },
        update: async (_id: string, memoryId: string, value: Partial<MockBrainMemory>) => {
          const memory = brainMemories.find((item) => item.id === memoryId); if (!memory) throw new Error('Memória não encontrada.')
          Object.assign(memory, value, { updatedAt: now }); if (value.status === 'active') memory.lastConfirmedAt = now; return memory
        },
        delete: async (_id: string, memoryId: string) => { brainMemories = brainMemories.filter((item) => item.id !== memoryId); return { deleted: true as const } },
        extract: async (_id: string, content: string) => {
          const pattern = /```nocturne-memories\s*\n([\s\S]*?)```/gi
          const created: MockBrainMemory[] = []
          let match: RegExpExecArray | null
          while ((match = pattern.exec(content)) !== null) {
            const values = JSON.parse(match[1]) as Array<Pick<MockBrainMemory, 'kind' | 'scope' | 'content' | 'confidence'>>
            for (const value of values) {
              const memory: MockBrainMemory = { id: `brain-${brainMemories.length + created.length + 1}`, workspaceId: workspace, conversationId: value.scope === 'conversation' ? conversation.id : null, ...value, status: 'candidate', sourceType: 'agent', sourceId: null, createdAt: now, updatedAt: now, lastConfirmedAt: null, lastUsedAt: null, useCount: 0 }
              created.push(memory)
            }
          }
          brainMemories = [...created, ...brainMemories]
          return { memories: created, content: content.replace(pattern, '').trim() }
        },
      },
      artifacts: { list: async () => [], page: async () => ({ items: [], hasMore: false }), delete: noop },
      suggestions: { list: async () => [], page: async () => ({ items: [], hasMore: false }), create: async (_id: string, content: string) => ({ suggestions: [], content }), status: noop },
      data: { export: async () => '/tmp/backup.json', import: async () => true },
      diagnostics: { openLogs: noop, copy: async () => 'diagnóstico', rendererError: noop, rendererStats: noop },
      settings: { get: async () => ({ model: '', sandbox: 'workspace-write', approvalPolicy: 'on-request', theme: 'dark', defaultAgentMode: 'review', codexVersion: 'codex-cli 0.144.1', codexCompatible: true, authenticated: true, authStatus: 'Autenticado', serverStatus: 'ready' }), check: async () => ({ model: '', sandbox: 'workspace-write', approvalPolicy: 'on-request', theme: 'dark', defaultAgentMode: 'review', codexVersion: 'codex-cli 0.144.1', codexCompatible: true, authenticated: true, authStatus: 'Autenticado', serverStatus: 'ready' }), set: async (value: unknown) => value },
      git: { status: async () => ({ branch: 'master', status: 'M src/App.tsx', diff: '', files: [{ path: 'src/App.tsx', status: 'M' }] }), commit: noop },
      documents: { saveMarkdown: async () => '/tmp/resposta.md', export: async () => '/tmp/resposta.pdf' },
      clipboard: { readText: async () => '', writeText: noop },
    }
    Object.defineProperty(window, 'nocturne', { configurable: true, value: api })
    Object.defineProperty(window, '__nocturneTest', { configurable: true, value: {
      emitEvent: (payload: unknown) => eventListeners.forEach((listener) => listener(payload)),
      emitStatus: (payload: unknown) => statusListeners.forEach((listener) => listener(payload)),
      calls: () => ({ selectedExpected, memoryReads, resumes }),
    } })
  }, { empty: Boolean(options.empty), unauthorized: Boolean(options.unauthorized) })
}
