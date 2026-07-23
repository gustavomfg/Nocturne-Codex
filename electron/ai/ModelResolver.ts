import type { WorkspaceModelBindings } from '../../shared/ai/bindings'
import { workspaceModelBindingsSchema } from '../../shared/ai/bindingSchemas'
import type { ModelDescriptor, ModelReference } from '../../shared/ai/model'
import type { ProviderAvailability } from '../../shared/ai/provider'
import type { NormalizedTask, TaskModelSelection } from '../../shared/ai/task'
import { ModelRegistry } from './ModelRegistry'
import { ProviderRegistry } from './ProviderRegistry'

export type ModelResolutionErrorCode =
  | 'invalid-bindings'
  | 'workspace-mismatch'
  | 'binding-not-found'
  | 'model-unavailable'
  | 'capability-mismatch'
  | 'provider-unavailable'
  | 'fallback-confirmation-required'

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
  source: 'explicit' | 'role' | 'workspace-default' | 'configured-fallback'
  usedFallback: boolean
}

interface Candidate {
  reference: ModelReference
  source: ResolvedModel['source']
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

    const primary = resolvePrimary(task.selection, bindings)
    const candidates = [primary]
    if (task.selection.type !== 'explicit' && bindings.fallbackPolicy === 'configured') {
      candidates.push(...bindings.fallbackBindings.map((reference) => ({
        reference,
        source: 'configured-fallback' as const,
      })))
    }

    let lastFailure: ModelResolutionError | undefined
    for (const [index, candidate] of candidates.entries()) {
      try {
        const resolved = await this.validateCandidate(task, candidate)
        return { ...resolved, usedFallback: index > 0 }
      } catch (error) {
        lastFailure = asResolutionError(error, candidate.reference)
        if (index === 0 && task.selection.type === 'explicit') throw lastFailure
        if (bindings.fallbackPolicy !== 'configured') break
      }
    }

    if (
      bindings.fallbackPolicy === 'explicit'
      && bindings.fallbackBindings.length > 0
      && task.selection.type !== 'explicit'
    ) {
      throw new ModelResolutionError(
        'fallback-confirmation-required',
        'O modelo selecionado está indisponível. Confirme um fallback antes de continuar.',
        {
          failure: lastFailure?.code,
          alternatives: bindings.fallbackBindings,
        },
      )
    }
    throw lastFailure ?? new ModelResolutionError(
      'binding-not-found',
      'Nenhum modelo foi resolvido para a tarefa.',
    )
  }

  private async validateCandidate(
    task: NormalizedTask,
    candidate: Candidate,
  ): Promise<Omit<ResolvedModel, 'usedFallback'>> {
    let model: ModelDescriptor
    try {
      model = this.models.resolve(candidate.reference)
    } catch {
      throw new ModelResolutionError(
        'model-unavailable',
        `Modelo não encontrado: ${candidate.reference.providerId}/${candidate.reference.modelId}`,
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
    return { model, providerAvailability, source: candidate.source }
  }
}

function resolvePrimary(
  selection: TaskModelSelection,
  bindings: WorkspaceModelBindings,
): Candidate {
  if (selection.type === 'explicit') {
    return { reference: selection.model, source: 'explicit' }
  }
  if (selection.type === 'role') {
    const roleBinding = bindings.roleBindings[selection.role]
    if (roleBinding) return { reference: roleBinding, source: 'role' }
  }
  if (bindings.defaultBinding) {
    return { reference: bindings.defaultBinding, source: 'workspace-default' }
  }
  throw new ModelResolutionError(
    'binding-not-found',
    selection.type === 'role'
      ? `Nenhum modelo foi configurado para a role ${selection.role}.`
      : 'Nenhum modelo padrão foi configurado para o Workspace.',
  )
}

function asResolutionError(error: unknown, reference: ModelReference) {
  if (error instanceof ModelResolutionError) return error
  return new ModelResolutionError(
    'model-unavailable',
    `Falha ao resolver ${reference.providerId}/${reference.modelId}.`,
  )
}
