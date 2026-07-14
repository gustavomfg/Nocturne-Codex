import type { Page } from '@playwright/test'

export async function installNocturneMock(page: Page, options: { empty?: boolean } = {}) {
  await page.addInitScript(({ empty }) => {
    localStorage.setItem('nocturne.onboarding.completed', 'true')
    const now = '2026-07-13T20:00:00.000Z'
    const workspace = '/workspace/nocturne-codex'
    const conversation = { id: 'conversation-1', title: 'Lapidação da experiência', workspace, codexThreadId: 'thread-1', createdAt: now, updatedAt: now }
    const eventListeners: Array<(payload: unknown) => void> = []
    const statusListeners: Array<(payload: unknown) => void> = []
    const noop = async () => undefined
    const api = {
      workspace: { select: async () => workspace, validate: async () => true, list: async () => [{ path: workspace, name: 'nocturne-codex', favorite: true, createdAt: now, lastOpenedAt: now }], remove: noop, favorite: noop, openTool: noop },
      conversations: {
        list: async () => empty ? [] : [conversation],
        create: async () => conversation,
        messages: async () => empty ? [] : [
          { id: 'message-1', conversationId: conversation.id, role: 'user', content: 'Deixe a experiência mais fluida e previsível.', metadata: null, createdAt: now },
          { id: 'message-2', conversationId: conversation.id, role: 'assistant', content: 'A interface foi analisada. Os fluxos prioritários estão organizados e prontos para validação.', metadata: null, createdAt: now },
        ],
        delete: noop,
      },
      codex: {
        start: noop, restart: noop, diagnostics: async () => ({ executable: 'codex', pid: 42, state: 'ready', lastFailure: null, logsPath: '/tmp/nocturne' }), send: noop, resume: noop, interrupt: noop,
        saveAssistant: async () => ({ id: 'saved-message' }), approve: noop,
        onEvent: (listener: (payload: unknown) => void) => { eventListeners.push(listener); return () => { const index = eventListeners.indexOf(listener); if (index >= 0) eventListeners.splice(index, 1) } },
        onStatus: (listener: (payload: unknown) => void) => { statusListeners.push(listener); return () => { const index = statusListeners.indexOf(listener); if (index >= 0) statusListeners.splice(index, 1) } },
      },
      files: { attach: async () => [], open: noop, preview: async (_id: string, filePath: string) => ({ kind: 'text', name: filePath.split('/').pop(), filePath, mime: 'text/plain', content: 'conteúdo', size: 8 }) },
      memory: { get: async () => ({ content: '', rules: '', updatedAt: '' }), set: async (_id: string, content: string, rules: string) => ({ content, rules, updatedAt: now }) },
      artifacts: { list: async () => [], delete: noop },
      suggestions: { list: async () => [], create: async (_id: string, content: string) => ({ suggestions: [], content }), status: noop },
      data: { export: async () => '/tmp/backup.json', import: async () => true },
      diagnostics: { openLogs: noop, copy: async () => 'diagnóstico', rendererError: noop, rendererStats: noop },
      settings: { get: async () => ({ model: '', sandbox: 'workspace-write', approvalPolicy: 'on-request', theme: 'dark', defaultAgentMode: 'review', codexVersion: 'codex-cli 0.144.1', codexCompatible: true, authenticated: true, authStatus: 'Autenticado', serverStatus: 'ready' }), set: async (value: unknown) => value },
      git: { status: async () => ({ branch: 'master', status: 'M src/App.tsx', diff: '', files: [{ path: 'src/App.tsx', status: 'M' }] }), commit: noop },
      documents: { saveMarkdown: async () => '/tmp/resposta.md', export: async () => '/tmp/resposta.pdf' },
      clipboard: { readText: async () => '', writeText: noop },
    }
    Object.defineProperty(window, 'nocturne', { configurable: true, value: api })
    Object.defineProperty(window, '__nocturneTest', { configurable: true, value: {
      emitEvent: (payload: unknown) => eventListeners.forEach((listener) => listener(payload)),
      emitStatus: (payload: unknown) => statusListeners.forEach((listener) => listener(payload)),
    } })
  }, { empty: Boolean(options.empty) })
}
