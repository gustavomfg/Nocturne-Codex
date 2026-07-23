import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, describe, expect, it } from 'vitest'
import { backupSchema } from '../shared/ipc/backupSchemas'
import { assertBackupByteLimit, assertBackupRecordLimit, BACKUP_LIMITS, PERSISTENCE_PERFORMANCE_BUDGETS } from '../shared/ipc/backupLimits'
import { parseBackupInWorker, serializeBackupInWorker } from '../electron/ipc/backupWorkers'

const now = new Date().toISOString()
const workspace = { path: '/tmp/project', name: 'project', favorite: 0 as const, created_at: now, last_opened_at: now }
const conversation = { id: randomUUID(), title: 'Teste', workspace: workspace.path, codex_thread_id: null, created_at: now, updated_at: now }
const valid = () => ({ schemaVersion: 5, exportedAt: now, workspaces: [workspace], conversations: [conversation], messages: [], artifacts: [], memories: [], suggestions: [], suggestionDecisions: [], settings: { theme: 'dark' as const } })
const modelDescriptor = { providerId: 'provider-1', modelId: 'model-1', displayName: 'Model 1', source: 'remote' as const, capabilities: ['chat'] as const, availability: 'available' as const }
const modelCatalogItem = { provider_id: modelDescriptor.providerId, model_id: modelDescriptor.modelId, descriptor: JSON.stringify(modelDescriptor), updated_at: now }
const modelBindings = { workspaceId: workspace.path, defaultBinding: { providerId: modelDescriptor.providerId, modelId: modelDescriptor.modelId }, roleBindings: {}, fallbackPolicy: 'disabled' as const, fallbackBindings: [] }
const workspaceModelBinding = { workspace_id: workspace.path, bindings: JSON.stringify(modelBindings), updated_at: now }
const temporaryFiles: string[] = []

afterEach(() => { for (const file of temporaryFiles.splice(0)) fs.rmSync(file, { force: true }) })

describe('schema de backup', () => {
  it('aceita um backup válido e aplica defaults seguros', () => {
    expect(backupSchema.parse(valid())).toMatchObject({ schemaVersion: 5, conversations: [{ id: conversation.id }] })
  })

  it('rejeita campos desconhecidos e conteúdo excessivo', () => {
    expect(() => backupSchema.parse({ ...valid(), unexpected: true })).toThrow()
    expect(() => backupSchema.parse({ ...valid(), conversations: [{ ...conversation, title: 'x'.repeat(501) }] })).toThrow()
  })

  it('rejeita referências órfãs antes de tocar no banco', () => {
    const data = valid()
    const message = { id: randomUUID(), conversation_id: randomUUID(), role: 'user' as const, content: 'órfã', metadata: null, created_at: now }
    expect(() => backupSchema.parse({ ...data, messages: [message] })).toThrow(/Conversa referenciada não existe/)
    expect(() => backupSchema.parse({ ...data, conversations: [{ ...conversation, workspace: '/tmp/unknown' }] })).toThrow(/Workspace referenciado não existe/)
    const brainMemory = { id: randomUUID(), workspace_id: workspace.path, conversation_id: randomUUID(), kind: 'fact', scope: 'conversation', status: 'active', content: 'Órfã', confidence: 80, source_type: 'manual', source_id: null, created_at: now, updated_at: now, last_confirmed_at: now, last_used_at: null, use_count: 0 }
    expect(() => backupSchema.parse({ ...data, brainMemories: [brainMemory] })).toThrow(/conversa inexistente/)
    expect(() => backupSchema.parse({ ...data, brainMemories: [{ ...brainMemory, conversation_id: conversation.id, content: 'token=abcdefghijklmnop' }] })).toThrow(/credencial/)
  })
  it('rejeita identificadores duplicados antes da restauração', () => {
    const data = valid()
    expect(() => backupSchema.parse({ ...data, conversations: [conversation, conversation] })).toThrow(/duplicados/)
    const provider = { id: randomUUID(), provider_type: 'openai-compatible', display_name: 'Provider', source: 'remote', base_url: 'https://provider.example/v1', enabled: 1, requires_authentication: 1, timeout_ms: 30_000, created_at: now, updated_at: now }
    expect(() => backupSchema.parse({ ...data, providerConfigs: [provider, provider] })).toThrow(/duplicados/)
    expect(() => backupSchema.parse({ ...data, modelCatalog: [modelCatalogItem, modelCatalogItem] })).toThrow(/duplicados/)
    expect(() => backupSchema.parse({ ...data, workspaceModelBindings: [workspaceModelBinding, workspaceModelBinding] })).toThrow(/duplicados/)
  })

  it('preserva configuração de Provider sem aceitar referência de credencial', () => {
    const provider = { id: randomUUID(), provider_type: 'openai-compatible', display_name: 'Provider', source: 'remote', base_url: 'https://provider.example/v1', enabled: 1, requires_authentication: 1, timeout_ms: 30_000, created_at: now, updated_at: now }
    expect(backupSchema.parse({ ...valid(), providerConfigs: [provider] }))
      .toMatchObject({ providerConfigs: [{ display_name: 'Provider' }] })
    expect(() => backupSchema.parse({
      ...valid(),
      providerConfigs: [{
        ...provider,
        credential_ref: '9ba7e635-8746-48bd-a8e9-4609ff1690cb',
      }],
    })).toThrow()
  })

  it('valida snapshots normalizados de modelos e bindings do workspace', () => {
    expect(backupSchema.parse({
      ...valid(),
      modelCatalog: [modelCatalogItem],
      workspaceModelBindings: [workspaceModelBinding],
    })).toMatchObject({
      modelCatalog: [{ model_id: modelDescriptor.modelId }],
      workspaceModelBindings: [{ workspace_id: workspace.path }],
    })
    expect(() => backupSchema.parse({
      ...valid(),
      modelCatalog: [{ ...modelCatalogItem, model_id: 'another-model' }],
    })).toThrow(/Descriptor de modelo inconsistente/)
    expect(() => backupSchema.parse({
      ...valid(),
      workspaceModelBindings: [{
        ...workspaceModelBinding,
        workspace_id: '/tmp/another-workspace',
      }],
    })).toThrow(/Bindings de modelos inconsistentes/)
    expect(() => backupSchema.parse({
      ...valid(),
      workspaces: [],
      conversations: [],
      workspaceModelBindings: [workspaceModelBinding],
    })).toThrow(/Workspace dos bindings não existe/)
  })

  it('rejeita UUIDs, enums e JSON serializado inválidos', () => {
    const data = valid()
    expect(() => backupSchema.parse({ ...data, conversations: [{ ...conversation, id: 'not-a-uuid' }] })).toThrow()
    const message = { id: randomUUID(), conversation_id: conversation.id, role: 'owner', content: 'x', metadata: '{', created_at: now }
    expect(() => backupSchema.parse({ ...data, messages: [message] })).toThrow()
  })

  it('usa uma única fronteira agregada em todos os limites relevantes', () => {
    expect(() => assertBackupRecordLimit({ messages: new Array(50_000) })).not.toThrow()
    expect(() => assertBackupRecordLimit({ messages: new Array(50_001) })).not.toThrow()
    expect(() => assertBackupRecordLimit({ messages: new Array(BACKUP_LIMITS.maxRecords) })).not.toThrow()
    expect(() => assertBackupRecordLimit({ messages: new Array(BACKUP_LIMITS.maxRecords + 1) })).toThrow(/200\.000 registros/)
    expect(() => assertBackupByteLimit(BACKUP_LIMITS.maxBytes)).not.toThrow()
    expect(() => assertBackupByteLimit(BACKUP_LIMITS.maxBytes + 1)).toThrow(/25 MB/)
  })

  it('serializa e reabre no worker backups acima do antigo limite de 50.000 registros', async () => {
    const file = path.join(os.tmpdir(), `nocturne-backup-worker-${randomUUID()}.json`)
    temporaryFiles.push(file)
    const startedAt = performance.now()
    const serialized = await serializeBackupInWorker({ messages: new Array(PERSISTENCE_PERFORMANCE_BUDGETS.workerRoundTripRecords).fill(null) })
    fs.writeFileSync(file, serialized)
    const parsed = await parseBackupInWorker(file) as { messages: unknown[] }
    expect(parsed.messages).toHaveLength(PERSISTENCE_PERFORMANCE_BUDGETS.workerRoundTripRecords)
    expect(performance.now() - startedAt).toBeLessThan(PERSISTENCE_PERFORMANCE_BUDGETS.workerRoundTripMs)
  }, 10_000)
})
