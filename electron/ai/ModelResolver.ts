import type { WorkspaceModelBindings } from '../../shared/ai/bindings'
import { workspaceModelBindingsSchema } from '../../shared/ai/bindingSchemas'
import type { ModelDescriptor } from '../../shared/ai/model'
import type { ProviderAvailability } from '../../shared/ai/provider'
import type { NormalizedTask } from '../../shared/ai/task'
import { ModelRegistry } from './ModelRegistry'
import { ProviderRegistry } from './ProviderRegistry'

export type ModelResolutionErrorCode =
  | 'invalid-bindings'
  | 'workspace-mismatch'
  | 'binding-not-found'
  | 'model-unavailable'
  | 'capability-mismatch'
  | 'provider-unavailable'

export class ModelResolutionError extends Error {
  constructor(
    readonly code: ModelResolutionErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ModelResolutionError'
  }
}

export interface ResolvedModel {
  model: ModelDescriptor
  providerAvailability: ProviderAvailability
}

export class ModelResolver {
  constructor(
    private readonly models: ModelRegistry,
    private readonly providers: ProviderRegistry,
  ) {}

  async resolve(task: NormalizedTask, input: unknown): Promise<ResolvedModel> {
    const parsed = workspaceModelBindingsSchema.safeParse(input)
    if (!parsed.success) {
      throw new ModelResolutionError(
        'invalid-bindings',
        'Configuração de modelos do Workspace inválida.',
        parsed.error,
      )
    }
    const bindings = parsed.data as WorkspaceModelBindings
    if (bindings.workspaceId !== task.workspace.id) {
      throw new ModelResolutionError(
        'workspace-mismatch',
        'Os bindings não pertencem ao Workspace da tarefa.',
      )
    }

    const reference = resolvePrimary(task.selection, bindings)
    return this.validateModel(task, reference)
  }

  private async validateModel(
    task: NormalizedTask,
    reference: WorkspaceModelBindings['defaultBinding'],
  ): Promise<ResolvedModel> {
    if (!reference) {
      throw new ModelResolutionError(
        'binding-not-found',
        'Nenhum modelo padrão foi configurado para o Workspace.',
      )
    }

    let model: ModelDescriptor
    try {
      model = this.models.resolve(reference)
    } catch {
      throw new ModelResolutionError(
        'model-unavailable',
        `Modelo não encontrado: ${reference.providerId}/${reference.modelId}`,
      )
    }
    if (model.availability !== 'available') {
      throw new ModelResolutionError(
        'model-unavailable',
        `O modelo ${model.displayName} não está disponível.`,
        { availability: model.availability },
      )
    }
    const missing = task.requirements.filter(
      (capability) => !model.capabilities.includes(capability),
    )
    if (missing.length > 0) {
      throw new ModelResolutionError(
        'capability-mismatch',
        `O modelo ${model.displayName} não atende às capacidades exigidas.`,
        { missing },
      )
    }

    let providerAvailability: ProviderAvailability
    try {
      providerAvailability = await this.providers.getAvailability(model.providerId)
    } catch {
      throw new ModelResolutionError(
        'provider-unavailable',
        `Provider não registrado: ${model.providerId}`,
      )
    }
    if (!['available', 'degraded'].includes(providerAvailability.status)) {
      throw new ModelResolutionError(
        'provider-unavailable',
        `O Provider ${model.providerId} não está disponível.`,
        { availability: providerAvailability.status },
      )
    }
    return { model, providerAvailability }
  }
}

function resolvePrimary(
  selection: NormalizedTask['selection'],
  bindings: WorkspaceModelBindings,
): WorkspaceModelBindings['defaultBinding'] {
  if (selection.type === 'explicit') return selection.model
  return bindings.defaultBinding
}
