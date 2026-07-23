import type { NormalizedErrorCode } from '../../../../shared/ai/execution'
import type { ModelDescriptor } from '../../../../shared/ai/model'
import type { ProviderAvailability } from '../../../../shared/ai/provider'
import type {
  ProviderExecutionControl,
  ProviderExecutionRequest,
  ProviderExecutionResult,
} from '../../../../shared/ai/providerExecution'
import { modelDescriptorSchema } from '../../../../shared/ai/modelSchemas'
import { ProviderExecutionError } from '../../ProviderExecutionError'
import type { ProviderAdapter } from '../../ProviderRegistry'
import {
  OPENAI_COMPATIBLE_LIMITS,
  parseOpenAICompatibleConfig,
  providerEndpoint,
  type OpenAICompatibleConfig,
} from './config'
import { buildOpenAICompatibleRequest } from './request'
import {
  consumeOpenAICompatibleStream,
  OpenAICompatibleProtocolError,
  readBoundedJson,
} from './stream'

export interface OpenAICompatibleDependencies {
  config: unknown
  models: readonly unknown[]
  resolveCredential: () => string | undefined | Promise<string | undefined>
  fetch?: typeof fetch
}

export class OpenAICompatibleProviderAdapter implements ProviderAdapter {
  readonly definition
  private readonly config: OpenAICompatibleConfig
  private readonly models: ModelDescriptor[]
  private readonly request: typeof fetch

  constructor(private readonly dependencies: OpenAICompatibleDependencies) {
    this.config = parseOpenAICompatibleConfig(dependencies.config)
    this.definition = {
      id: this.config.id,
      displayName: this.config.displayName,
      source: this.config.source,
    }
    this.models = dependencies.models.map((model) => {
      const parsed = modelDescriptorSchema.parse(model) as ModelDescriptor
      if (parsed.providerId !== this.config.id || parsed.source !== this.config.source) {
        throw new Error('O catálogo OpenAI-compatible não pertence à configuração.')
      }
      return cloneModel(parsed)
    })
    this.request = dependencies.fetch ?? globalThis.fetch
  }

  async getAvailability(): Promise<ProviderAvailability> {
    if (!this.config.enabled) return { status: 'disabled' }
    try {
      const catalog = await this.requestModelCatalog()
      const discovered = new Set(catalog.map(({ modelId }) => modelId))
      if (this.models.some((model) => !discovered.has(model.modelId))) {
        return {
          status: 'degraded',
          message: 'Um ou mais modelos configurados não estão disponíveis.',
        }
      }
      return { status: 'available' }
    } catch (error) {
      if (error instanceof ProviderExecutionError) {
        return availabilityFromError(error)
      }
      return {
        status: 'offline',
        message: 'Não foi possível acessar o endpoint do Provider.',
      }
    }
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return this.requestModelCatalog()
  }

  async execute(
    execution: ProviderExecutionRequest,
    control: ProviderExecutionControl,
  ): Promise<ProviderExecutionResult> {
    if (!this.config.enabled) {
      throw providerError('provider-unavailable', 'O Provider está desabilitado.', false)
    }
    if (execution.model.providerId !== this.config.id) {
      throw providerError(
        'model-unavailable',
        'O modelo selecionado não pertence a este Provider.',
        false,
      )
    }

    let credential: string | undefined
    try {
      credential = await this.resolveCredential()
    } catch {
      throw providerError(
        'authentication-failed',
        'A credencial do Provider não está disponível.',
        false,
      )
    }
    if (control.signal.aborted) throw cancelledError()

    const request = createRequestControl(control.signal, this.config.timeoutMs)
    try {
      const response = await this.request(
        providerEndpoint(this.config, 'chat/completions'),
        {
          method: 'POST',
          headers: requestHeaders(credential),
          body: JSON.stringify(buildOpenAICompatibleRequest(
            execution.task,
            execution.model.modelId,
          )),
          redirect: 'error',
          signal: request.signal,
        },
      )
      if (!response.ok) throw errorFromStatus(response.status)
      return await consumeOpenAICompatibleStream(
        response,
        execution.executionId,
        control,
      )
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error
      if (control.signal.aborted) throw cancelledError()
      if (request.didTimeout()) {
        throw providerError('timeout', 'O Provider excedeu o tempo permitido.', true)
      }
      if (error instanceof OpenAICompatibleProtocolError) {
        throw providerError(
          'invalid-response',
          'O Provider retornou uma resposta inválida.',
          false,
        )
      }
      throw providerError(
        'provider-unavailable',
        'Não foi possível concluir a chamada ao Provider.',
        true,
      )
    } finally {
      request.dispose()
    }
  }

  private async resolveCredential() {
    const credential = (await this.dependencies.resolveCredential())?.trim()
    if (this.config.requiresAuthentication && !credential) {
      throw new Error('Credencial ausente.')
    }
    return credential || undefined
  }

  private async requestModelCatalog(): Promise<ModelDescriptor[]> {
    let credential: string | undefined
    try {
      credential = await this.resolveCredential()
    } catch {
      throw providerError(
        'authentication-failed',
        'A credencial do Provider não está disponível.',
        false,
      )
    }

    const request = createRequestControl(undefined, this.config.timeoutMs)
    try {
      const response = await this.request(providerEndpoint(this.config, 'models'), {
        method: 'GET',
        headers: requestHeaders(credential),
        redirect: 'error',
        signal: request.signal,
      })
      if (!response.ok) throw errorFromStatus(response.status)
      return normalizeModelCatalog(
        await readBoundedJson(response),
        this.config,
        this.models,
      )
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error
      if (request.didTimeout()) {
        throw providerError('timeout', 'O Provider excedeu o tempo permitido.', true)
      }
      if (error instanceof OpenAICompatibleProtocolError) {
        throw providerError(
          'invalid-response',
          'O catálogo de modelos do Provider é inválido.',
          false,
        )
      }
      throw providerError(
        'provider-unavailable',
        'Não foi possível acessar o endpoint do Provider.',
        true,
      )
    } finally {
      request.dispose()
    }
  }
}

function requestHeaders(credential: string | undefined) {
  return {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  }
}

function createRequestControl(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timedOut = false
  const onAbort = () => controller.abort()
  if (parent?.aborted) controller.abort()
  else parent?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose() {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onAbort)
    },
  }
}

function availabilityFromError(error: ProviderExecutionError): ProviderAvailability {
  if (error.normalized.code === 'authentication-failed') {
    return { status: 'authentication-required', message: 'A credencial foi recusada.' }
  }
  if (error.normalized.code === 'model-unavailable') {
    return { status: 'incompatible', message: 'O endpoint de modelos não foi encontrado.' }
  }
  if (error.normalized.code === 'timeout') {
    return { status: 'offline', message: 'O teste de conexão excedeu o tempo permitido.' }
  }
  return {
    status: error.normalized.code === 'provider-unavailable' ? 'offline' : 'degraded',
    message: error.normalized.message,
  }
}

function errorFromStatus(status: number) {
  if (status === 401 || status === 403) {
    return providerError(
      'authentication-failed',
      'A autenticação do Provider foi recusada.',
      false,
    )
  }
  if (status === 404) {
    return providerError('model-unavailable', 'O modelo solicitado não está disponível.', false)
  }
  if (status === 408 || status === 504) {
    return providerError('timeout', 'O Provider excedeu o tempo permitido.', true)
  }
  if (status === 429) {
    return providerError('rate-limited', 'O limite temporário do Provider foi atingido.', true)
  }
  return providerError(
    status >= 500 ? 'provider-unavailable' : 'invalid-response',
    status >= 500
      ? 'O Provider está temporariamente indisponível.'
      : 'O Provider recusou a solicitação.',
    status >= 500,
  )
}

function providerError(
  code: NormalizedErrorCode,
  message: string,
  retryable: boolean,
) {
  return new ProviderExecutionError({ code, message, retryable })
}

function cancelledError() {
  return providerError('cancelled', 'A execução foi cancelada.', false)
}

function normalizeModelCatalog(
  value: unknown,
  config: OpenAICompatibleConfig,
  knownModels: readonly ModelDescriptor[],
): ModelDescriptor[] {
  const body = asRecord(value)
  if (!body || !Array.isArray(body.data) || body.data.length > OPENAI_COMPATIBLE_LIMITS.models) {
    throw new OpenAICompatibleProtocolError()
  }
  const known = new Map(knownModels.map((model) => [model.modelId, model]))
  const identifiers = new Set<string>()
  return body.data.map((nativeModel) => {
    const record = asRecord(nativeModel)
    const modelId = typeof record?.id === 'string' ? record.id.trim() : ''
    if (!modelId || modelId.length > 512 || identifiers.has(modelId)) {
      throw new OpenAICompatibleProtocolError()
    }
    identifiers.add(modelId)
    const current = known.get(modelId)
    if (current) return { ...cloneModel(current), availability: 'available' }
    const nativeName = typeof record?.name === 'string' ? record.name.trim() : ''
    return {
      providerId: config.id,
      modelId,
      displayName: nativeName && nativeName.length <= 500
        ? nativeName
        : modelId.slice(0, 500),
      source: config.source,
      capabilities: [],
      availability: 'available',
    }
  })
}

function cloneModel(model: ModelDescriptor): ModelDescriptor {
  return {
    ...model,
    capabilities: [...model.capabilities],
    pricing: model.pricing ? { ...model.pricing } : undefined,
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}
