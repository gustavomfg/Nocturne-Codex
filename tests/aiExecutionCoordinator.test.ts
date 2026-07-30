import { describe, expect, it, vi } from 'vitest'
import { AiExecutionCoordinator } from '../electron/ai/AiExecutionCoordinator'
import { ModelRegistry } from '../electron/ai/ModelRegistry'
import { ProviderRegistry } from '../electron/ai/ProviderRegistry'
import type { WorkspaceModelBindings } from '../shared/ai/bindings'
import type { ModelDescriptor } from '../shared/ai/model'
import type { NormalizedTaskInput } from '../shared/ai/task'
import { FakeProviderAdapter } from './helpers/FakeProviderAdapter'

const descriptor: ModelDescriptor = { providerId: 'fake', modelId: 'model', displayName: 'Fake', source: 'local', capabilities: ['chat', 'streaming'], availability: 'available' }
const bindings: WorkspaceModelBindings = { workspaceId: '/workspace', defaultBinding: { providerId: 'fake', modelId: 'model' } }
const task: NormalizedTaskInput = {
  workspace: { id: '/workspace', name: 'Workspace' }, intent: 'Analise.', mode: 'review', messages: [], context: [], constraints: [],
  requirements: ['chat', 'streaming'], selection: { type: 'workspace-default' }, output: { format: 'markdown' }, permissions: { workspaceAccess: 'read-only' }, tools: [],
}

describe('AiExecutionCoordinator', () => {
  it('persiste a resposta antes de publicar a conclusão ao renderer', async () => {
    const sent: Array<{ channel: string; payload: Record<string, unknown> }> = []
    const win = { isDestroyed: () => false, webContents: { send: (channel: string, payload: Record<string, unknown>) => sent.push({ channel, payload }) } }
    const models = new ModelRegistry(); models.register(descriptor)
    const providers = new ProviderRegistry(); providers.register(new FakeProviderAdapter([descriptor], { events: [{ type: 'message.delta', messageId: 'assistant', delta: 'Resposta durável.' }] }))
    const finalize = vi.fn(() => ({ message: { id: 'message-1', conversationId: 'conversation-1', role: 'assistant' as const, content: 'Resposta durável.', metadata: null, createdAt: '2026-07-29T10:00:00.000Z' } }))
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const coordinator = new AiExecutionCoordinator(win as never, models, providers, logger as never, new Map(), finalize)
    await coordinator.startProvider('conversation-1', task, bindings)
    await vi.waitFor(() => expect(finalize).toHaveBeenCalledOnce())
    const completion = sent.find(({ channel, payload }) => channel === 'ai:event' && payload.method === 'turn/completed')
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conversation-1', content: 'Resposta durável.', mode: 'review' }))
    expect(completion?.payload).toMatchObject({ params: { persistedMessage: { id: 'message-1', content: 'Resposta durável.' } } })
    coordinator.dispose()
  })
})
