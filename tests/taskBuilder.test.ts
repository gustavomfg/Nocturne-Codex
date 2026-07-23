import { describe, expect, it } from 'vitest'
import { TaskBuilder, TaskBuilderError } from '../electron/ai/TaskBuilder'
import { AI_TASK_LIMITS, type NormalizedTaskInput } from '../shared/ai/task'
import { normalizedTaskSchema } from '../shared/ai/taskSchemas'

function input(overrides: Partial<NormalizedTaskInput> = {}): NormalizedTaskInput {
  return {
    workspace: { id: 'workspace-1', name: 'Nocturne' },
    intent: 'Revise a arquitetura atual.',
    mode: 'review',
    messages: [],
    context: [{
      id: 'memory-1',
      type: 'memory',
      title: 'Workspace First',
      content: 'O Workspace é o produto.',
      scope: 'workspace',
      potentiallyOutdated: true,
    }],
    constraints: ['Não modifique arquivos.'],
    requirements: ['chat', 'streaming'],
    selection: { type: 'workspace-default' },
    output: { format: 'markdown' },
    permissions: { workspaceAccess: 'read-only' },
    tools: [],
    ...overrides,
  }
}

describe('TaskBuilder', () => {
  it('constrói uma tarefa provider-independent com identidade determinística', () => {
    const builder = new TaskBuilder(
      () => '5f79f691-dc24-441c-a475-cbb1e09fb8af',
      () => new Date('2026-07-23T10:00:00.000Z'),
    )

    expect(builder.build(input())).toEqual({
      ...input(),
      id: '5f79f691-dc24-441c-a475-cbb1e09fb8af',
      createdAt: '2026-07-23T10:00:00.000Z',
    })
  })

  it('mantém seleção explícita como referência normalizada de modelo', () => {
    const task = new TaskBuilder().build(input({
      selection: {
        type: 'explicit',
        model: { providerId: 'openrouter', modelId: 'example/model' },
      },
    }))

    expect(task.selection).toEqual({
      type: 'explicit',
      model: { providerId: 'openrouter', modelId: 'example/model' },
    })
    expect(JSON.stringify(task)).not.toContain('apiKey')
  })

  it('impede que Review Mode solicite escrita no Workspace', () => {
    expect(() => new TaskBuilder().build(input({
      permissions: { workspaceAccess: 'workspace-write' },
    }))).toThrow(expect.objectContaining<Partial<TaskBuilderError>>({
      name: 'TaskBuilderError',
    }))
    expect(() => normalizedTaskSchema.parse({
      ...new TaskBuilder().build(input()),
      permissions: { workspaceAccess: 'workspace-write' },
    })).toThrow(/Review Mode/)
  })

  it('preserva memórias como dados potencialmente desatualizados', () => {
    expect(() => new TaskBuilder().build(input({
      context: [{
        id: 'memory-1',
        type: 'memory',
        title: 'Decisão antiga',
        content: 'Usar somente um Provider.',
        scope: 'workspace',
        potentiallyOutdated: false,
      }],
    }))).toThrow(TaskBuilderError)

    expect(new TaskBuilder().build(input({
      context: [{
        id: 'memory-1',
        type: 'memory',
        title: 'Decisão antiga',
        content: 'Usar somente um Provider.',
        scope: 'workspace',
        potentiallyOutdated: true,
      }],
    })).context[0]).toMatchObject({
      type: 'memory',
      potentiallyOutdated: true,
    })
  })

  it('rejeita capacidades, fontes e campos provider-native duplicados', () => {
    expect(() => new TaskBuilder().build(input({
      requirements: ['chat', 'chat'],
    }))).toThrow(TaskBuilderError)
    expect(() => new TaskBuilder().build(input({
      context: [input().context[0], input().context[0]],
    }))).toThrow(TaskBuilderError)
    expect(() => new TaskBuilder().build({
      ...input(),
      openAIRequestBody: {},
    })).toThrow(TaskBuilderError)
  })

  it('aplica limite agregado ao contexto antes da compilação do Provider', () => {
    const content = 'x'.repeat(AI_TASK_LIMITS.contextSourceCharacters)
    const context = Array.from({ length: 6 }, (_, index) => ({
      id: `memory-${index}`,
      type: 'memory' as const,
      title: `Memória ${index}`,
      content,
      scope: 'workspace',
      potentiallyOutdated: true,
    }))

    expect(() => new TaskBuilder().build(input({ context }))).toThrow(TaskBuilderError)
  })

  it('não aceita ferramentas antes do contrato normalizado de Tool Calling', () => {
    expect(() => new TaskBuilder().build({
      ...input(),
      tools: [{ id: 'run-anything' }],
    })).toThrow(TaskBuilderError)
  })
})
