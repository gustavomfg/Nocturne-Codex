import type {
  ExecutionEventPayload,
  NormalizedExecutionEvent,
} from '../../shared/ai/execution'
import {
  executionEventPayloadSchema,
  executionIdSchema,
  normalizedExecutionEventSchema,
} from '../../shared/ai/executionSchemas'

export type ExecutionEventStreamErrorCode =
  | 'invalid-execution-id'
  | 'invalid-event'
  | 'invalid-transition'
  | 'execution-finished'

export class ExecutionEventStreamError extends Error {
  constructor(
    readonly code: ExecutionEventStreamErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ExecutionEventStreamError'
  }
}

export class ExecutionEventStream {
  private sequence = 0
  private state: 'pending' | 'running' | 'terminal' = 'pending'

  constructor(
    private readonly executionId: string,
    private readonly onEvent?: (event: NormalizedExecutionEvent) => void,
    private readonly now: () => Date = () => new Date(),
  ) {
    const parsed = executionIdSchema.safeParse(executionId)
    if (!parsed.success) {
      throw new ExecutionEventStreamError(
        'invalid-execution-id',
        'Identificador de execução inválido.',
        parsed.error,
      )
    }
  }

  get status() {
    return this.state
  }

  emit(input: unknown): NormalizedExecutionEvent {
    if (this.state === 'terminal') {
      throw new ExecutionEventStreamError(
        'execution-finished',
        'A execução já alcançou um estado terminal.',
      )
    }

    const parsed = executionEventPayloadSchema.safeParse(input)
    if (!parsed.success) {
      throw new ExecutionEventStreamError(
        'invalid-event',
        'Evento de execução inválido.',
        parsed.error,
      )
    }
    const payload = parsed.data as ExecutionEventPayload
    this.assertTransition(payload)

    const event = normalizedExecutionEventSchema.parse({
      ...payload,
      executionId: this.executionId,
      sequence: this.sequence,
      timestamp: this.now().toISOString(),
    }) as NormalizedExecutionEvent

    this.sequence += 1
    this.state = isTerminal(payload.type) ? 'terminal' : 'running'
    this.onEvent?.(event)
    return event
  }

  private assertTransition(payload: ExecutionEventPayload) {
    if (this.state === 'pending' && payload.type !== 'execution.started') {
      throw new ExecutionEventStreamError(
        'invalid-transition',
        'O primeiro evento deve iniciar a execução.',
      )
    }
    if (this.state === 'running' && payload.type === 'execution.started') {
      throw new ExecutionEventStreamError(
        'invalid-transition',
        'A execução não pode ser iniciada mais de uma vez.',
      )
    }
  }
}

function isTerminal(type: ExecutionEventPayload['type']) {
  return type === 'execution.completed'
    || type === 'execution.failed'
    || type === 'execution.cancelled'
}
