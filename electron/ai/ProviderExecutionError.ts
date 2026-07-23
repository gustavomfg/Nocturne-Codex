import type { NormalizedProviderError } from '../../shared/ai/execution'
import { providerExecutionErrorSchema } from '../../shared/ai/providerExecutionSchemas'

export class ProviderExecutionError extends Error {
  readonly normalized: NormalizedProviderError

  constructor(error: unknown) {
    const parsed = providerExecutionErrorSchema.parse(error)
    super(parsed.message)
    this.name = 'ProviderExecutionError'
    this.normalized = parsed
  }
}
