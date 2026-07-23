export const normalizedErrorCodes = [
  'authentication-failed',
  'permission-denied',
  'rate-limited',
  'model-unavailable',
  'provider-unavailable',
  'invalid-response',
  'timeout',
  'cancelled',
] as const

export const normalizedFinishReasons = [
  'stop',
  'length',
  'tool-calls',
  'cancelled',
  'error',
  'unknown',
] as const

export const AI_EXECUTION_LIMITS = {
  identifierCharacters: 512,
  messageDeltaCharacters: 100_000,
  errorMessageCharacters: 4_000,
} as const

export type NormalizedErrorCode = typeof normalizedErrorCodes[number]
export type NormalizedFinishReason = typeof normalizedFinishReasons[number]

export interface NormalizedUsage {
  inputTokens?: number
  cachedInputTokens?: number
  outputTokens?: number
}

export interface NormalizedProviderError {
  code: NormalizedErrorCode
  message: string
  retryable: boolean
  retryAfterMs?: number
}

export type ExecutionEventPayload =
  | {
    type: 'execution.started'
    providerId: string
    modelId: string
  }
  | {
    type: 'message.delta'
    messageId: string
    delta: string
  }
  | {
    type: 'usage.updated'
    usage: NormalizedUsage
  }
  | {
    type: 'execution.completed'
    finishReason: NormalizedFinishReason
  }
  | {
    type: 'execution.failed'
    error: NormalizedProviderError
  }
  | {
    type: 'execution.cancelled'
    reason?: string
  }

export interface ExecutionEventEnvelope {
  executionId: string
  sequence: number
  timestamp: string
}

export type NormalizedExecutionEvent = ExecutionEventEnvelope & ExecutionEventPayload
