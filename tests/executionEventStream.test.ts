import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  ExecutionEventStream,
  ExecutionEventStreamError,
} from '../electron/ai/ExecutionEventStream'
import { AI_EXECUTION_LIMITS } from '../shared/ai/execution'

describe('ExecutionEventStream', () => {
  it('envelopa eventos com identidade, ordem e timestamp determinísticos', () => {
    const executionId = randomUUID()
    const onEvent = vi.fn()
    const now = vi.fn()
      .mockReturnValueOnce(new Date('2026-07-22T12:00:00.000Z'))
      .mockReturnValueOnce(new Date('2026-07-22T12:00:01.000Z'))
      .mockReturnValueOnce(new Date('2026-07-22T12:00:02.000Z'))
    const stream = new ExecutionEventStream(executionId, onEvent, now)

    const started = stream.emit({
      type: 'execution.started',
      providerId: 'openai',
      modelId: 'example-model',
    })
    const delta = stream.emit({
      type: 'message.delta',
      messageId: 'message-1',
      delta: 'Resposta',
    })
    const completed = stream.emit({
      type: 'execution.completed',
      finishReason: 'stop',
    })

    expect([started.sequence, delta.sequence, completed.sequence]).toEqual([0, 1, 2])
    expect(started).toMatchObject({
      executionId,
      timestamp: '2026-07-22T12:00:00.000Z',
    })
    expect(stream.status).toBe('terminal')
    expect(onEvent).toHaveBeenCalledTimes(3)
  })

  it('exige início único e impede eventos após qualquer estado terminal', () => {
    const stream = new ExecutionEventStream(randomUUID())

    expect(() => stream.emit({
      type: 'message.delta',
      messageId: 'message-1',
      delta: 'inválido',
    })).toThrow(expect.objectContaining<Partial<ExecutionEventStreamError>>({
      code: 'invalid-transition',
    }))

    stream.emit({ type: 'execution.started', providerId: 'ollama', modelId: 'local' })
    expect(() => stream.emit({
      type: 'execution.started',
      providerId: 'ollama',
      modelId: 'local',
    })).toThrow(expect.objectContaining<Partial<ExecutionEventStreamError>>({
      code: 'invalid-transition',
    }))

    stream.emit({ type: 'execution.cancelled', reason: 'Solicitado pelo usuário.' })
    expect(() => stream.emit({
      type: 'message.delta',
      messageId: 'message-1',
      delta: 'tardio',
    })).toThrow(expect.objectContaining<Partial<ExecutionEventStreamError>>({
      code: 'execution-finished',
    }))
  })

  it('rejeita payloads nativos, contadores inválidos e conteúdo sem limite', () => {
    const native = new ExecutionEventStream(randomUUID())
    expect(() => native.emit({
      type: 'execution.started',
      providerId: 'openai',
      modelId: 'example',
      nativeResponse: {},
    })).toThrow(expect.objectContaining<Partial<ExecutionEventStreamError>>({
      code: 'invalid-event',
    }))

    const usage = new ExecutionEventStream(randomUUID())
    usage.emit({ type: 'execution.started', providerId: 'openai', modelId: 'example' })
    expect(() => usage.emit({
      type: 'usage.updated',
      usage: { inputTokens: -1 },
    })).toThrow(expect.objectContaining<Partial<ExecutionEventStreamError>>({
      code: 'invalid-event',
    }))
    expect(() => usage.emit({
      type: 'message.delta',
      messageId: 'message-1',
      delta: 'x'.repeat(AI_EXECUTION_LIMITS.messageDeltaCharacters + 1),
    })).toThrow(expect.objectContaining<Partial<ExecutionEventStreamError>>({
      code: 'invalid-event',
    }))
  })

  it.each([
    {
      type: 'execution.completed',
      finishReason: 'length',
    },
    {
      type: 'execution.failed',
      error: {
        code: 'rate-limited',
        message: 'Limite atingido.',
        retryable: true,
        retryAfterMs: 1_000,
      },
    },
    {
      type: 'execution.cancelled',
    },
  ] as const)('aceita o estado terminal $type', (terminal) => {
    const stream = new ExecutionEventStream(randomUUID())
    stream.emit({ type: 'execution.started', providerId: 'provider', modelId: 'model' })

    expect(stream.emit(terminal)).toMatchObject(terminal)
    expect(stream.status).toBe('terminal')
  })
})
