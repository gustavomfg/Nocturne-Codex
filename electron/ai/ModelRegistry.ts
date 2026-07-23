import { modelDescriptorSchema } from '../../shared/ai/modelSchemas'
import type {
  ModelAvailability,
  ModelCapability,
  ModelDescriptor,
  ModelReference,
} from '../../shared/ai/model'
import type { ProviderSource } from '../../shared/ai/provider'

export type ModelRegistryErrorCode =
  | 'duplicate-model'
  | 'invalid-model'
  | 'model-not-found'
  | 'provider-mismatch'

export class ModelRegistryError extends Error {
  constructor(
    readonly code: ModelRegistryErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ModelRegistryError'
  }
}

export interface ModelQuery {
  providerId?: string
  capabilities?: readonly ModelCapability[]
  availability?: ModelAvailability
  source?: ProviderSource
}

export class ModelRegistry {
  private readonly models = new Map<string, ModelDescriptor>()

  register(input: unknown): ModelDescriptor {
    const descriptor = parseDescriptor(input)
    const key = modelKey(descriptor)
    if (this.models.has(key)) {
      throw new ModelRegistryError(
        'duplicate-model',
        `Modelo já registrado: ${descriptor.providerId}/${descriptor.modelId}`,
      )
    }
    this.models.set(key, cloneDescriptor(descriptor))
    return cloneDescriptor(descriptor)
  }

  resolve(reference: ModelReference): ModelDescriptor {
    const descriptor = this.models.get(modelKey(reference))
    if (!descriptor) {
      throw new ModelRegistryError(
        'model-not-found',
        `Modelo não registrado: ${reference.providerId}/${reference.modelId}`,
      )
    }
    return cloneDescriptor(descriptor)
  }

  list(query: ModelQuery = {}): ModelDescriptor[] {
    return [...this.models.values()]
      .filter((descriptor) => matchesQuery(descriptor, query))
      .map(cloneDescriptor)
  }

  deleteProviderModels(providerId: string): void {
    for (const [key, descriptor] of this.models) {
      if (descriptor.providerId === providerId) this.models.delete(key)
    }
  }

  replaceProviderModels(providerId: string, inputs: readonly unknown[]): ModelDescriptor[] {
    const descriptors = inputs.map(parseDescriptor)
    const keys = new Set<string>()

    for (const descriptor of descriptors) {
      if (descriptor.providerId !== providerId) {
        throw new ModelRegistryError(
          'provider-mismatch',
          `O modelo ${descriptor.modelId} pertence a ${descriptor.providerId}, não a ${providerId}.`,
        )
      }
      const key = modelKey(descriptor)
      if (keys.has(key)) {
        throw new ModelRegistryError(
          'duplicate-model',
          `Modelo duplicado no catálogo de ${providerId}: ${descriptor.modelId}`,
        )
      }
      keys.add(key)
    }

    for (const [key, descriptor] of this.models) {
      if (descriptor.providerId === providerId) this.models.delete(key)
    }
    for (const descriptor of descriptors) {
      this.models.set(modelKey(descriptor), cloneDescriptor(descriptor))
    }
    return descriptors.map(cloneDescriptor)
  }
}

function parseDescriptor(input: unknown): ModelDescriptor {
  const parsed = modelDescriptorSchema.safeParse(input)
  if (!parsed.success) {
    throw new ModelRegistryError(
      'invalid-model',
      'Descriptor de modelo inválido.',
      parsed.error,
    )
  }
  return parsed.data
}

function modelKey(reference: ModelReference) {
  return JSON.stringify([reference.providerId, reference.modelId])
}

function matchesQuery(descriptor: ModelDescriptor, query: ModelQuery) {
  if (query.providerId !== undefined && descriptor.providerId !== query.providerId) return false
  if (query.availability !== undefined && descriptor.availability !== query.availability) return false
  if (query.source !== undefined && descriptor.source !== query.source) return false
  return query.capabilities?.every((capability) => descriptor.capabilities.includes(capability)) ?? true
}

function cloneDescriptor(descriptor: ModelDescriptor): ModelDescriptor {
  return {
    ...descriptor,
    capabilities: [...descriptor.capabilities],
    pricing: descriptor.pricing ? { ...descriptor.pricing } : undefined,
  }
}
