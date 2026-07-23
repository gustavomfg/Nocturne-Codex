import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Cloud,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { WorkspaceModelBindings } from '../../../shared/ai/bindings'
import type { ModelDescriptor, ModelReference } from '../../../shared/ai/model'
import type { ProviderConfigurationSummary } from '../../../shared/ai/providerConfiguration'
import { errorMessage } from '../../shared/format'

interface ModelSettingsPageProps {
  workspaceId: string
  onDirtyChange(dirty: boolean): void
  onNotify(message: string): void
}

const MAX_VISIBLE_MODELS = 200

export function ModelSettingsPage({
  workspaceId,
  onDirtyChange,
  onNotify,
}: ModelSettingsPageProps) {
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [providers, setProviders] = useState<ProviderConfigurationSummary[]>([])
  const [bindings, setBindings] = useState<WorkspaceModelBindings | null>(null)
  const [baseline, setBaseline] = useState('')
  const [query, setQuery] = useState('')
  const [refreshProviderId, setRefreshProviderId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = Boolean(bindings && JSON.stringify(bindings) !== baseline)
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void Promise.all([
      window.nocturne.models.list(),
      window.nocturne.providers.list(),
    ]).then(async ([catalog, configuredProviders]) => {
      if (!active) return
      setModels(catalog)
      setProviders(configuredProviders)
      const providerIds = providerChoices(configuredProviders, catalog)
      setRefreshProviderId((current) => (
        current && providerIds.includes(current) ? current : providerIds[0] ?? ''
      ))
      if (!workspaceId) {
        setBindings(null)
        setBaseline('')
        return
      }
      const stored = await window.nocturne.models.bindings(workspaceId)
      if (!active) return
      const next = stored ?? emptyBindings(workspaceId)
      setBindings(next)
      setBaseline(JSON.stringify(next))
    }).catch((failure) => {
      if (active) setError(errorMessage(failure))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      onDirtyChange(false)
    }
  }, [workspaceId, onDirtyChange])

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return models.filter((model) => !normalized || [
      model.displayName,
      model.modelId,
      model.providerId,
      model.family ?? '',
    ].some((value) => value.toLocaleLowerCase().includes(normalized)))
  }, [models, query])
  const visibleModels = filteredModels.slice(0, MAX_VISIBLE_MODELS)
  const providerIds = providerChoices(providers, models)

  const updateBinding = (reference?: ModelReference) => {
    setBindings((current) => {
      if (!current) return current
      return { ...current, defaultBinding: reference }
    })
  }

  const save = async () => {
    if (!bindings || saving || !dirty) return
    setSaving(true)
    setError(null)
    try {
      const saved = await window.nocturne.models.setBindings(bindings)
      setBindings(saved)
      setBaseline(JSON.stringify(saved))
      onNotify('Modelo do workspace atualizado.')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  const refresh = async () => {
    if (!refreshProviderId || refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const result = await window.nocturne.models.refresh(refreshProviderId)
      const catalog = await window.nocturne.models.list()
      setModels(catalog)
      onNotify(result.status === 'applied'
        ? 'Catálogo de modelos atualizado.'
        : 'Uma descoberta mais recente já atualizou o catálogo.')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setRefreshing(false)
    }
  }

  return <div className="model-settings">
    <div className="model-settings-intro">
      <div>
        <strong>Modelos do Workspace</strong>
        <p>Escolha o modelo que o workspace usará por padrão.</p>
      </div>
      <span>{models.length.toLocaleString('pt-BR')} {models.length === 1 ? 'modelo' : 'modelos'}</span>
    </div>

    {error && <div className="model-feedback error" role="alert">{error}</div>}

    {!workspaceId && !loading && <div className="model-empty">
      <Boxes size={27}/>
      <strong>Selecione um workspace</strong>
      <p>O modelo é definido por workspace. O catálogo global continua independente.</p>
    </div>}

    {loading && <div className="model-empty" aria-live="polite">
      <LoaderCircle className="spin" size={23}/>
      <strong>Carregando catálogo…</strong>
    </div>}

    {!loading && workspaceId && bindings && <>
      <section className="model-binding-panel" aria-labelledby="model-bindings-title">
        <header>
          <div><strong id="model-bindings-title">Modelo do workspace</strong><small title={workspaceId}>{workspaceName(workspaceId)}</small></div>
          <span className={dirty ? 'pending' : undefined}>{dirty ? 'Alterações pendentes' : 'Sincronizado'}</span>
        </header>

        <label className="model-search">
          <span>Filtrar modelos</span>
          <div><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, Provider ou família"/></div>
          <small>{filteredModels.length > MAX_VISIBLE_MODELS ? `Mostrando os primeiros ${MAX_VISIBLE_MODELS.toLocaleString('pt-BR')} resultados.` : `${filteredModels.length.toLocaleString('pt-BR')} resultados disponíveis.`}</small>
        </label>

        <ModelSelect
          label="Modelo padrão"
          detail="Usado em todas as execuções deste workspace"
          emptyLabel="Nenhum modelo selecionado"
          value={bindings.defaultBinding}
          models={visibleModels}
          catalog={models}
          onChange={(reference) => updateBinding(reference)}
        />

        <footer>
          <small>Modelos incompatíveis serão recusados antes da execução.</small>
          <button className="primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </section>

      <section className="model-catalog-panel" aria-labelledby="model-catalog-title">
        <div><strong id="model-catalog-title">Catálogo de modelos</strong><small>Atualiza a lista de modelos disponíveis do Provider escolhido.</small></div>
        <div className="model-refresh-controls">
          <label>Provider<select value={refreshProviderId} disabled={!providerIds.length || refreshing} onChange={(event) => setRefreshProviderId(event.target.value)}>{!providerIds.length && <option value="">Nenhum Provider disponível</option>}{providerIds.map((providerId) => <option key={providerId} value={providerId}>{providerLabel(providerId, providers)}</option>)}</select></label>
          <button disabled={!refreshProviderId || refreshing} onClick={() => void refresh()}><RefreshCw className={refreshing ? 'spin' : undefined} size={15}/>{refreshing ? 'Atualizando…' : 'Atualizar catálogo'}</button>
        </div>
      </section>
    </>}
  </div>
}

function ModelSelect({
  label,
  detail,
  emptyLabel,
  value,
  models,
  catalog,
  onChange,
}: {
  label: string
  detail: string
  emptyLabel: string
  value?: ModelReference
  models: ModelDescriptor[]
  catalog: ModelDescriptor[]
  onChange(reference?: ModelReference): void
}) {
  const currentKey = value ? modelKey(value) : ''
  const current = value && catalog.find((model) => modelKey(model) === currentKey)
  const visibleCurrent = current && models.some((model) => modelKey(model) === currentKey)
  const unresolved = value && !current
    ? { ...value, displayName: `${value.providerId}/${value.modelId}`, source: 'remote' as const, capabilities: [], availability: 'offline' as const }
    : undefined
  const selected = current ?? unresolved
  const options = value && !visibleCurrent && selected
    ? [selected, ...models]
    : models
  return <label className="model-select">
    <span><strong>{label}</strong><small>{detail}</small></span>
    <select value={currentKey} onChange={(event) => onChange(parseModelKey(event.target.value))}>
      <option value="">{emptyLabel}</option>
      {options.map((model) => <option key={modelKey(model)} value={modelKey(model)} disabled={model.availability !== 'available'}>
        {model.displayName} · {model.providerId}{model.availability !== 'available' ? ` · ${availabilityLabel(model.availability)}` : ''}
      </option>)}
    </select>
    {value && <span className="model-selection-meta">{sourceIcon(current?.source)}{value.providerId} / {value.modelId}</span>}
  </label>
}

function emptyBindings(workspaceId: string): WorkspaceModelBindings {
  return { workspaceId }
}

function providerChoices(
  providers: ProviderConfigurationSummary[],
  models: ModelDescriptor[],
) {
  return [...new Set([
    ...providers.map((provider) => provider.id),
    ...models.map((model) => model.providerId),
  ])]
}

function providerLabel(
  providerId: string,
  providers: ProviderConfigurationSummary[],
) {
  return providers.find((provider) => provider.id === providerId)?.displayName
    ?? providerId
}

function modelKey(reference: ModelReference) {
  return JSON.stringify([reference.providerId, reference.modelId])
}

function parseModelKey(value: string): ModelReference | undefined {
  if (!value) return undefined
  const [providerId, modelId] = JSON.parse(value) as [string, string]
  return { providerId, modelId }
}

function workspaceName(workspaceId: string) {
  return workspaceId.split(/[/\\]/).filter(Boolean).pop() ?? workspaceId
}

function availabilityLabel(availability: ModelDescriptor['availability']) {
  return ({
    available: 'Disponível',
    disabled: 'Desabilitado',
    offline: 'Offline',
    'missing-credentials': 'Credencial necessária',
    incompatible: 'Incompatível',
    deprecated: 'Obsoleto',
  })[availability]
}

function sourceIcon(source: ModelDescriptor['source'] | undefined) {
  return source === 'local' ? <HardDrive size={13}/> : <Cloud size={13}/>
}
