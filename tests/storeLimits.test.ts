import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../src/store'
import { PERSISTENCE_LIMITS } from '../shared/constants'
import { exportDocumentSchema, saveAssistantSchema, saveMarkdownSchema } from '../shared/ipc/schemas'

beforeEach(() => useAppStore.setState({ streaming: '', activities: [] }))

describe('limites de estabilidade do renderer', () => {
  it('limita o buffer acumulado da resposta', () => {
    useAppStore.getState().appendStream('x'.repeat(2_100_000))
    expect(useAppStore.getState().streaming).toHaveLength(2_000_000)
  })
  it('mantém apenas as atividades recentes e limita detalhes', () => {
    for (let index = 0; index < 350; index += 1) useAppStore.getState().upsertActivity({ id: String(index), type: 'read', label: 'Leitura', detail: 'x'.repeat(70_000), status: 'completed' })
    const activities = useAppStore.getState().activities
    expect(activities).toHaveLength(300)
    expect(activities[0].id).toBe('50')
    expect(activities.at(-1)?.detail).toHaveLength(64_000)
  })
})

describe('limites de persistência IPC', () => {
  const conversationId = '00000000-0000-4000-8000-000000000001'
  it('aceita conteúdo exatamente no limite', () => {
    expect(saveAssistantSchema.safeParse({ conversationId, content: 'x'.repeat(PERSISTENCE_LIMITS.assistantCharacters) }).success).toBe(true)
    expect(saveMarkdownSchema.safeParse({ conversationId, content: 'x'.repeat(PERSISTENCE_LIMITS.documentCharacters), name: 'a'.repeat(PERSISTENCE_LIMITS.documentNameCharacters) }).success).toBe(true)
  })
  it('rejeita conteúdo e nome imediatamente acima do limite', () => {
    expect(saveAssistantSchema.safeParse({ conversationId, content: 'x'.repeat(PERSISTENCE_LIMITS.assistantCharacters + 1) }).success).toBe(false)
    expect(exportDocumentSchema.safeParse({ conversationId, content: 'x'.repeat(PERSISTENCE_LIMITS.documentCharacters + 1), format: 'pdf' }).success).toBe(false)
    expect(saveMarkdownSchema.safeParse({ conversationId, content: '', name: 'a'.repeat(PERSISTENCE_LIMITS.documentNameCharacters + 1) }).success).toBe(false)
  })
})
