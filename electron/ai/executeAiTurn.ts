import type { WorkspaceModelBindings } from '../../shared/ai/bindings'
import type { NormalizedTaskInput } from '../../shared/ai/task'
import { TaskBuilder } from './TaskBuilder'
import { ModelResolver } from './ModelResolver'
import { ModelRegistry } from './ModelRegistry'
import { ProviderRegistry } from './ProviderRegistry'
import { AIOrchestrator } from './AIOrchestrator'
import type { NormalizedExecutionEvent } from '../../shared/ai/execution'
import type { ExecutionHandle } from './AIOrchestrator'

export interface ProviderAiTurn {
  executionId: string
  completion: Promise<void>
  cancel(reason?: string): boolean
}

export async function startAiTurn(
  models: ModelRegistry,
  providers: ProviderRegistry,
  taskInput: NormalizedTaskInput,
  bindings: WorkspaceModelBindings,
  emit: (method: string, params: Record<string, unknown>) => void,
): Promise<ProviderAiTurn> {
  const task = new TaskBuilder().build(taskInput)
  const resolver = new ModelResolver(models, providers)
  const orchestrator = new AIOrchestrator(resolver, providers)
  let executionError = 'A execução do Provider falhou.'

  const handle: ExecutionHandle = await orchestrator.start(
    task,
    bindings,
    (event: NormalizedExecutionEvent) => {
      if (event.type === 'message.delta') {
        emit('item/agentMessage/delta', { delta: event.delta })
      } else if (event.type === 'execution.failed') {
        executionError = event.error.message
      }
    },
  )

  return {
    executionId: handle.executionId,
    cancel: (reason?: string) => handle.cancel(reason),
    completion: handle.completion.then((outcome) => {
      if (outcome.status === 'failed') {
        emit('error', { message: executionError })
      }
      emit('turn/completed', {
        turn: {
          id: outcome.executionId,
          ...(outcome.status === 'failed'
            ? { error: { message: executionError } }
            : {}),
        },
      })
    }),
  }
}
