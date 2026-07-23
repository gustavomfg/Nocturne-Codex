import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type { WorkspaceModelBindings } from '../../shared/ai/bindings'
import type { NormalizedTaskInput } from '../../shared/ai/task'
import { TaskBuilder } from './TaskBuilder'
import { ModelResolver } from './ModelResolver'
import { ModelRegistry } from './ModelRegistry'
import { ProviderRegistry } from './ProviderRegistry'
import { AIOrchestrator } from './AIOrchestrator'
import type { NormalizedExecutionEvent, NormalizedProviderError } from '../../shared/ai/execution'

function emitCodexEvent(win: BrowserWindow, method: string, params: Record<string, unknown>) {
  if (!win.isDestroyed()) {
    win.webContents.send('ai:event', { method, params })
  }
}

export async function executeAiTurn(
  win: BrowserWindow,
  models: ModelRegistry,
  providers: ProviderRegistry,
  taskInput: NormalizedTaskInput,
  bindings: WorkspaceModelBindings,
): Promise<void> {
  try {
    const taskBuilder = new TaskBuilder()
    const task = taskBuilder.build(taskInput)
    const resolver = new ModelResolver(models, providers)
    const orchestrator = new AIOrchestrator(resolver, providers)

    let executionError: NormalizedProviderError | undefined

    const handle = await orchestrator.start(task, bindings, (event: NormalizedExecutionEvent) => {
      if (event.type === 'message.delta') {
        emitCodexEvent(win, 'item/agentMessage/delta', { delta: event.delta })
      }
      if (event.type === 'execution.failed') {
        executionError = event.error
      }
    })

    const outcome = await handle.completion

    if (outcome.status === 'failed') {
      emitCodexEvent(win, 'error', {
        message: executionError?.message ?? 'A execução do Provider falhou.',
      })
      emitCodexEvent(win, 'turn/completed', {
        turn: { id: outcome.executionId, error: { message: executionError?.message ?? 'A execução do Provider falhou.' } },
      })
      return
    }

    if (outcome.status === 'cancelled') {
      emitCodexEvent(win, 'turn/completed', {
        turn: { id: outcome.executionId },
      })
      return
    }

    emitCodexEvent(win, 'turn/completed', {
      turn: { id: outcome.executionId },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno na execução de IA.'
    emitCodexEvent(win, 'error', { message })
    emitCodexEvent(win, 'turn/completed', {
      turn: { id: randomUUID(), error: { message } },
    })
  }
}
