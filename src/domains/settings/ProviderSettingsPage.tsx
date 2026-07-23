import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  CircleOff,
  Cloud,
  Cpu,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Server,
  Trash2,
  Wifi,
  X,
} from 'lucide-react'
import {
  configurationFromProviderCatalog,
  providerCatalog,
  type ProviderCatalogEntry,
  type ProviderCatalogId,
} from '../../../shared/ai/providerCatalog'
import type {
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../../../shared/ai/providerConfiguration'
import type { ProviderAvailability } from '../../../shared/ai/provider'
import { errorMessage } from '../../shared/format'

interface ProviderEditor {
  id?: string
  presetId?: ProviderCatalogId
  configuration: ProviderConfigurationInput
  baseline: string
  credential: string
  clearCredential: boolean
  credentialConfigured: boolean
}

interface ProviderSettingsPageProps {
  workspaceId: string
  onDirtyChange(dirty: boolean): void
  onNotify(message: string): void
}

const defaultConfiguration: ProviderConfigurationInput = {
  providerType: 'openai-compatible',
  displayName: '',
  source: 'remote',
  baseUrl: 'https://api.openai.com/v1',
  enabled: false,
  requiresAuthentication: true,
  timeoutMs: 30_000,
}

export function ProviderSettingsPage({
  workspaceId,
  onDirtyChange,
  onNotify,
}: ProviderSettingsPageProps) {
  const [providers, setProviders] = useState<ProviderConfigurationSummary[]>([])
  const [editor, setEditor] = useState<ProviderEditor | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [availability, setAvailability] = useState<Record<string, ProviderAvailability>>({})
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(() => Boolean(editor && (
    JSON.stringify(editor.configuration) !== editor.baseline
    || editor.credential.length > 0
    || editor.clearCredential
  )), [editor])

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    let active = true
    void window.nocturne.providers.list()
      .then((items) => {
        if (active) setProviders(items)
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [onDirtyChange])

  const beginCreate = () => {
    setShowCatalog(true)
    setConfirmRemove(null)
    setError(null)
  }

  const beginPreset = (entry: ProviderCatalogEntry) => {
    const configuration = configurationFromProviderCatalog(entry.id)
    if (!configuration) return
    setShowCatalog(false)
    setEditor({
      presetId: entry.id,
      configuration,
      baseline: JSON.stringify(configuration),
      credential: '',
      clearCredential: false,
      credentialConfigured: false,
    })
    setError(null)
  }

  const beginCustom = () => {
    const configuration = { ...defaultConfiguration }
    setShowCatalog(false)
    setEditor({
      configuration,
      baseline: JSON.stringify(configuration),
      credential: '',
      clearCredential: false,
      credentialConfigured: false,
    })
    setError(null)
  }

  const beginEdit = (provider: ProviderConfigurationSummary) => {
    const configuration = toConfiguration(provider)
    setEditor({
      id: provider.id,
      presetId: matchingPreset(provider)?.id,
      configuration,
      baseline: JSON.stringify(configuration),
      credential: '',
      clearCredential: false,
      credentialConfigured: provider.credentialConfigured,
    })
    setConfirmRemove(null)
    setError(null)
  }

  const updateConfiguration = (
    value: Partial<ProviderConfigurationInput>,
  ) => {
    setEditor((current) => current
      ? { ...current, configuration: { ...current.configuration, ...value } }
      : current)
  }

  const save = async () => {
    if (!editor || saving) return
    setSaving(true)
    setError(null)
    try {
      const saved = editor.id
        ? await window.nocturne.providers.update(
          editor.id,
          editor.configuration,
          {
            ...(editor.credential ? { credential: editor.credential } : {}),
            ...(editor.clearCredential ? { clearCredential: true } : {}),
          },
        )
        : await window.nocturne.providers.create(
          editor.configuration,
          editor.credential || undefined,
        )
      setProviders((current) => editor.id
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current])
      setAvailability((current) => ({
        ...current,
        [saved.id]: saved.enabled
          ? { status: 'available', message: 'Conexão validada ao salvar.' }
          : { status: 'disabled' },
      }))
      setEditor(null)
      if (saved.enabled) {
        try {
          await window.nocturne.models.refresh(saved.id)
          onNotify(workspaceId
            ? 'Conexão pronta. Escolha abaixo se este workspace deve usá-la.'
            : 'Conexão pronta e modelos sincronizados.')
        } catch {
          setError('Conexão salva, mas os modelos não puderam ser atualizados.')
          onNotify(editor.id ? 'Conexão atualizada.' : 'Conexão adicionada.')
        }
      } else {
        onNotify(editor.id ? 'Conexão atualizada.' : 'Conexão adicionada.')
      }
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (id: string) => {
    if (testingId) return
    setTestingId(id)
    setError(null)
    try {
      const result = await window.nocturne.providers.testConnection(id)
      setAvailability((current) => ({ ...current, [id]: result }))
      if (result.status === 'available') {
        try {
          await window.nocturne.models.refresh(id)
          onNotify(workspaceId
            ? 'Conexão validada. O uso neste workspace não foi alterado.'
            : 'Conexão validada e modelos sincronizados.')
        } catch {
          setError('Conexão validada, mas o catálogo de modelos não pôde ser atualizado.')
        }
      }
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setTestingId(null)
    }
  }

  const remove = async (id: string) => {
    if (confirmRemove !== id) {
      setConfirmRemove(id)
      return
    }
    setRemovingId(id)
    setError(null)
    try {
      await window.nocturne.providers.remove(id)
      setProviders((current) => current.filter((item) => item.id !== id))
      setAvailability((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setConfirmRemove(null)
      if (editor?.id === id) setEditor(null)
      onNotify('Conexão removida.')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setRemovingId(null)
    }
  }

  return <div className="provider-settings">
    <div className="provider-settings-intro">
      <div>
        <strong>Suas conexões por API</strong>
        <p>Adicione uma chave própria sem alterar automaticamente o workspace.</p>
      </div>
      <button className="provider-add" disabled={Boolean(editor) || showCatalog} onClick={beginCreate}>
        <Plus size={15}/>Adicionar conexão
      </button>
    </div>

    {error && <div className="provider-feedback error" role="alert">{error}</div>}

    {showCatalog && !editor && <ProviderCatalog
      onBack={() => setShowCatalog(false)}
      onPreset={beginPreset}
      onCustom={beginCustom}
    />}

    {editor && <ProviderEditorForm
      editor={editor}
      saving={saving}
      onChange={updateConfiguration}
      onCredential={(credential) => setEditor((current) => current
        ? { ...current, credential, clearCredential: false }
        : current)}
      onClearCredential={(clearCredential) => setEditor((current) => current
        ? { ...current, clearCredential, credential: '' }
        : current)}
      onCancel={() => {
        setEditor(null)
        setError(null)
      }}
      onSave={() => void save()}
    />}

    {!editor && !showCatalog && <div className="provider-list" aria-busy={loading}>
      {loading && <div className="provider-empty"><LoaderCircle className="spin" size={22}/><strong>Carregando conexões…</strong></div>}
      {!loading && !providers.length && <div className="provider-empty">
        <KeyRound size={26}/>
        <strong>Nenhuma chave de API adicionada</strong>
        <p>Você pode usar OpenAI, OpenRouter ou DeepSeek. Modelos locais ficam nas opções avançadas.</p>
        <button className="provider-add" onClick={beginCreate}><Plus size={15}/>Usar chave de API</button>
      </div>}
      {providers.map((provider) => <ProviderCard
        key={provider.id}
        provider={provider}
        availability={availability[provider.id]}
        testing={testingId === provider.id}
        removing={removingId === provider.id}
        confirmingRemove={confirmRemove === provider.id}
        onEdit={() => beginEdit(provider)}
        onTest={() => void testConnection(provider.id)}
        onRemove={() => void remove(provider.id)}
        onCancelRemove={() => setConfirmRemove(null)}
      />)}
    </div>}
  </div>
}

function ProviderCatalog({
  onBack,
  onPreset,
  onCustom,
}: {
  onBack(): void
  onPreset(entry: ProviderCatalogEntry): void
  onCustom(): void
}) {
  const [advanced, setAdvanced] = useState(false)
  const entries = providerCatalog.filter((entry) => (
    advanced ? entry.source === 'local' : entry.source === 'remote'
  ))
  return <section className="provider-catalog" aria-labelledby="provider-catalog-title">
    <header>
      <button aria-label="Voltar" title="Voltar" onClick={() => advanced ? setAdvanced(false) : onBack()}>
        <ArrowLeft size={16}/>
      </button>
      <div>
        <h3 id="provider-catalog-title">{advanced ? 'Opções avançadas' : 'Usar uma chave de API'}</h3>
        <small>{advanced ? 'Conecte um runtime local ou configure seu próprio endpoint.' : 'Escolha onde sua chave foi criada.'}</small>
      </div>
    </header>
    <div className="provider-catalog-grid">
      {entries.map((entry) => {
        const available = entry.integrationStatus === 'available'
        const method = entry.connectionMethods.find(({ status }) => status === 'available')
        return <button
          key={entry.id}
          className="provider-catalog-card"
          disabled={!available}
          aria-label={`${entry.displayName}: ${available ? method?.label : 'Adapter necessário'}`}
          onClick={() => onPreset(entry)}
        >
          <span className={`provider-company-mark ${entry.source}`}>
            {entry.source === 'local' ? <Cpu size={19}/> : <Building2 size={19}/>}
          </span>
          <span className="provider-catalog-copy">
            <span className="provider-catalog-heading"><strong>{entry.displayName}</strong><em>{available ? 'Disponível' : 'Adapter necessário'}</em></span>
            <small>{entry.description}</small>
            <span className="provider-method">
              {method?.label ?? entry.connectionMethods[0]?.label}
              <i>{entry.protocol}</i>
            </span>
          </span>
        </button>
      })}
    </div>
    <footer>
      <span>{advanced ? 'Seu endpoint não está na lista?' : 'Prefere executar modelos na sua máquina?'}</span>
      {advanced
        ? <button onClick={onCustom}><Server size={15}/>Endpoint OpenAI-compatible</button>
        : <button onClick={() => setAdvanced(true)}><Cpu size={15}/>Modelos locais e avançado</button>}
    </footer>
  </section>
}

function ProviderEditorForm({
  editor,
  saving,
  onChange,
  onCredential,
  onClearCredential,
  onCancel,
  onSave,
}: {
  editor: ProviderEditor
  saving: boolean
  onChange(value: Partial<ProviderConfigurationInput>): void
  onCredential(value: string): void
  onClearCredential(value: boolean): void
  onCancel(): void
  onSave(): void
}) {
  const { configuration } = editor
  const preset = editor.presetId
    ? providerCatalog.find(({ id }) => id === editor.presetId)
    : undefined
  const connection = preset?.connectionMethods.find(({ status }) => status === 'available')
  const missingCredential = configuration.enabled
    && configuration.requiresAuthentication
    && !editor.credentialConfigured
    && !editor.credential

  return <section className="provider-editor" aria-labelledby="provider-editor-title">
    <header>
      <div><span>{preset?.source === 'local' ? <Cpu size={16}/> : preset ? <Building2 size={16}/> : <Server size={16}/>}</span><div><strong id="provider-editor-title">{editor.id ? `Editar ${preset?.displayName ?? 'conexão'}` : `Conectar ${preset?.displayName ?? 'endpoint personalizado'}`}</strong><small>{connection?.label ?? 'OpenAI-compatible avançado'}</small></div></div>
      <button aria-label="Cancelar edição da conexão" title="Cancelar edição" disabled={saving} onClick={onCancel}><X size={16}/></button>
    </header>
    <div className="provider-editor-body">
      <div className="settings-columns">
        <label>Nome da conexão<input autoFocus value={configuration.displayName} maxLength={500} onChange={(event) => onChange({ displayName: event.target.value })} placeholder="Ex.: Conta pessoal"/></label>
        <label>Timeout<select value={configuration.timeoutMs} onChange={(event) => onChange({ timeoutMs: Number(event.target.value) })}><option value={15_000}>15 segundos</option><option value={30_000}>30 segundos</option><option value={60_000}>60 segundos</option><option value={120_000}>120 segundos</option></select></label>
      </div>
      {connection && <div className="provider-connection-note"><KeyRound size={15}/><span><strong>{connection.label}</strong><small>{connection.detail}</small></span></div>}
      <div className={`provider-flags ${preset ? 'single' : ''}`}>
        {!preset && <label className="check-label"><input type="checkbox" checked={configuration.requiresAuthentication} onChange={(event) => onChange({ requiresAuthentication: event.target.checked })}/><span><strong>Usa credencial</strong><small>Envia um bearer token somente ao endpoint configurado</small></span></label>}
        <label className="check-label"><input type="checkbox" checked={configuration.enabled} onChange={(event) => onChange({ enabled: event.target.checked })}/><span><strong>Habilitar agora</strong><small>Exige validação de conexão antes de salvar</small></span></label>
      </div>
      {configuration.requiresAuthentication && <label>{connection?.kind === 'api-key' ? 'Chave de API' : 'Credencial'}
        <span className="provider-secret-field"><KeyRound size={15}/><input type="password" autoComplete="new-password" value={editor.credential} onChange={(event) => onCredential(event.target.value)} placeholder={editor.credentialConfigured ? 'Deixe vazio para manter a chave atual' : connection?.kind === 'api-key' ? 'Cole sua chave de API' : 'Cole a credencial'}/></span>
      </label>}
      {editor.credentialConfigured && configuration.requiresAuthentication && <label className="check-label provider-clear-secret"><input type="checkbox" checked={editor.clearCredential} onChange={(event) => onClearCredential(event.target.checked)}/><span><strong>Remover credencial armazenada</strong><small>A conexão precisará permanecer desabilitada</small></span></label>}
      {missingCredential && <p className="provider-inline-warning" role="alert">Informe uma credencial para habilitar esta conexão.</p>}
      <details className="provider-advanced" open={!preset}>
        <summary><ChevronDown size={15}/>Configuração avançada</summary>
        <div>
          <div className="settings-columns">
            <label>Origem<select value={configuration.source} onChange={(event) => {
              const source = event.target.value as ProviderConfigurationInput['source']
              onChange({
                source,
                baseUrl: source === 'local'
                  ? 'http://127.0.0.1:11434/v1'
                  : 'https://api.openai.com/v1',
              })
            }}><option value="remote">Remoto</option><option value="local">Local</option></select></label>
            <label>Tipo de integração<select value={configuration.providerType} disabled><option value="openai-compatible">OpenAI-compatible</option></select></label>
          </div>
          <label>URL-base da API<input type="url" value={configuration.baseUrl} maxLength={2_048} onChange={(event) => onChange({ baseUrl: event.target.value })} placeholder="https://provider.example/v1"/></label>
        </div>
      </details>
    </div>
    <footer>
      <span>{configuration.enabled ? 'Salvar executará um teste de conexão.' : 'O rascunho será salvo sem acessar a rede.'}</span>
      <div><button disabled={saving} onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving || !configuration.displayName.trim() || !configuration.baseUrl.trim() || missingCredential || (editor.clearCredential && configuration.enabled)} onClick={onSave}>{saving ? 'Validando…' : configuration.enabled ? 'Validar e salvar' : 'Salvar rascunho'}</button></div>
    </footer>
  </section>
}

function ProviderCard({
  provider,
  availability,
  testing,
  removing,
  confirmingRemove,
  onEdit,
  onTest,
  onRemove,
  onCancelRemove,
}: {
  provider: ProviderConfigurationSummary
  availability?: ProviderAvailability
  testing: boolean
  removing: boolean
  confirmingRemove: boolean
  onEdit(): void
  onTest(): void
  onRemove(): void
  onCancelRemove(): void
}) {
  const state = availability ?? {
    status: provider.enabled ? 'not-configured' as const : 'disabled' as const,
  }
  return <article className="provider-card">
    <div className="provider-card-icon">{provider.source === 'local' ? <Server size={18}/> : <Cloud size={18}/>}</div>
    <div className="provider-card-main">
      <div className="provider-card-title"><strong>{provider.displayName}</strong><span className={`provider-state ${state.status}`}>{availabilityLabel(state.status)}</span></div>
      <small title={provider.baseUrl}>{provider.baseUrl}</small>
      <div className="provider-card-meta">
        <span>{provider.source === 'local' ? 'Local' : 'Remoto'}</span>
        <span>{provider.credentialConfigured ? <><KeyRound size={12}/>Credencial protegida</> : <><CircleOff size={12}/>Sem credencial</>}</span>
        {state.message && <span title={state.message}>{state.message}</span>}
      </div>
    </div>
    <div className="provider-card-actions">
      {confirmingRemove ? <div className="provider-remove-confirm" role="alert">
        <span>Remover?</span>
        <button onClick={onCancelRemove}>Cancelar</button>
        <button className="danger" disabled={removing} onClick={onRemove}>{removing ? 'Removendo…' : 'Confirmar'}</button>
      </div> : <>
        <button aria-label={`Testar ${provider.displayName}`} title={provider.enabled ? 'Testar conexão' : 'Habilite o Provider antes de testar'} disabled={!provider.enabled || testing} onClick={onTest}>{testing ? <LoaderCircle className="spin" size={15}/> : <Wifi size={15}/>}</button>
        <button aria-label={`Editar ${provider.displayName}`} title="Editar conexão" onClick={onEdit}><Pencil size={15}/></button>
        <button className="danger-icon" aria-label={`Remover ${provider.displayName}`} title="Remover Provider" onClick={onRemove}><Trash2 size={15}/></button>
      </>}
    </div>
  </article>
}

function toConfiguration(
  provider: ProviderConfigurationSummary,
): ProviderConfigurationInput {
  return {
    providerType: provider.providerType,
    displayName: provider.displayName,
    source: provider.source,
    baseUrl: provider.baseUrl,
    enabled: provider.enabled,
    requiresAuthentication: provider.requiresAuthentication,
    timeoutMs: provider.timeoutMs,
  }
}

function matchingPreset(provider: ProviderConfigurationSummary) {
  const normalized = provider.baseUrl.replace(/\/$/, '')
  return providerCatalog.find(({ baseUrl }) => baseUrl?.replace(/\/$/, '') === normalized)
}

function availabilityLabel(status: ProviderAvailability['status']) {
  return ({
    'not-configured': 'Não testado',
    validating: 'Validando',
    available: 'Disponível',
    degraded: 'Degradado',
    offline: 'Offline',
    'authentication-required': 'Credencial necessária',
    incompatible: 'Incompatível',
    disabled: 'Desabilitado',
  })[status]
}
