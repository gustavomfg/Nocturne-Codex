import { ProviderExecutionError } from '../../electron/ai/ProviderExecutionError'
import type { ProviderAdapter } from '../../electron/ai/ProviderRegistry'
import type { NormalizedProviderError } from '../../shared/ai/execution'
import type { ModelDescriptor } from '../../shared/ai/model'
import type {
  ProviderExecutionRequest,
  ProviderStreamPayload,
} from '../../shared/ai/providerExecution'

interface FakeProviderScript {
  events?: ProviderStreamPayload[]
  error?: NormalizedProviderError
  finishReason?: 'stop' | 'length' | 'unknown'
  waitForCancellation?: boolean
}

export class FakeProviderAdapter implements ProviderAdapter {
  readonly definition
  readonly requests: ProviderExecutionRequest[] = []

  constructor(
    readonly models: ModelDescriptor[],
    private readonly script: FakeProviderScript = {},
  ) {
    const first = models[0]
    this.definition = {
      id: first?.providerId ?? 'fake',
      displayName: 'Fake Provider',
      source: first?.source ?? 'local',
    } as const
  }

  getAvailability() {
    return { status: 'available' as const }
  }

  listModels() {
    return this.models
  }

  async execute(
    request: ProviderExecutionRequest,
    control: Parameters<ProviderAdapter['execute']>[1],
  ) {
    this.requests.push(request)
    for (const event of this.script.events ?? []) {
      if (control.signal.aborted) break
      control.emit(event)
    }
    if (this.script.waitForCancellation && !control.signal.aborted) {
      await new Promise<void>((resolve) => {
        control.signal.addEventListener('abort', () => resolve(), { once: true })
      })
    }
    if (this.script.error) throw new ProviderExecutionError(this.script.error)
    return { finishReason: this.script.finishReason ?? 'stop' }
  }
}
