import type {
  ExecutionEventPayload,
  NormalizedFinishReason,
  NormalizedProviderError,
} from './execution'
import type { ModelDescriptor } from './model'
import type { NormalizedTask } from './task'

export type ProviderStreamPayload = Extract<
  ExecutionEventPayload,
  { type: 'message.delta' | 'usage.updated' }
>

export interface ProviderExecutionRequest {
  executionId: string
  task: NormalizedTask
  model: ModelDescriptor
}

export interface ProviderExecutionControl {
  signal: AbortSignal
  emit(payload: ProviderStreamPayload): void
}

export interface ProviderExecutionResult {
  finishReason: Extract<NormalizedFinishReason, 'stop' | 'length' | 'unknown'>
}

export interface ExecutionOutcome {
  executionId: string
  status: 'completed' | 'failed' | 'cancelled'
  model: ModelDescriptor
  finishReason?: ProviderExecutionResult['finishReason']
  error?: NormalizedProviderError
}
