import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Globe,
  Laptop,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type {
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../../../shared/ai/providerConfiguration'
import type { ModelDescriptor, ModelReference } from '../../../shared/ai/model'
import { errorMessage } from '../../shared/format'

type Step = 'list' | 'service' | 'auth' | 'model'

interface ServicePreset {
  id: string
  name: string
  icon: typeof Bot
  baseUrl: string
  authType: 'api-key' | 'local'
}

const presets: ServicePreset[] = [
  { id: 'openai', name: 'OpenAI', icon: Sparkles, baseUrl: 'https://api.openai.com/v1', authType: 'api-key' },
  { id: 'deepseek', name: 'DeepSeek', icon: Brain, baseUrl: 'https://api.deepseek.com', authType: 'api-key' },
  { id: 'openrouter', name: 'OpenRouter', icon: Bot, baseUrl: 'https://openrouter.ai/api/v1', authType: 'api-key' },
  { id: 'ollama', name: 'Ollama', icon: Laptop, baseUrl: 'http://127.0.0.1:11434/v1', authType: 'local' },
  { id: 'other', name: 'Outro', icon: Globe, baseUrl: '', authType: 'api-key' },
]

interface AIConnectionPageProps {
  workspaceId: string
  onNotify(message: string): void
}

export function AIConnectionPage({
  workspaceId,
  onNotify,
}: AIConnectionPageProps) {
  const [services, setServices] = useState<ProviderConfigurationSummary[]>([])
  const [step, setStep] = useState<Step>('list')
  const [selectedPreset, setSelectedPreset] = useState<ServicePreset | null>(null)
  const [credential, setCredential] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelReference | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.nocturne.providers.list()
      .then((items) => { if (active) setServices(items) })
      .catch((failure) => { if (active) setError(errorMessage(failure)) })
    return () => { active = false }
  }, [])

  const resetWizard = () => {
    setStep('list')
    setSelectedPreset(null)
    setCredential('')
    setCustomUrl('')
    setModels([])
    setSelectedModel(null)
    setShowAdvanced(false)
    setError(null)
  }

  const pickService = (preset: ServicePreset) => {
    setSelectedPreset(preset)
    setCustomUrl('')
    setCredential('')
    setShowAdvanced(false)
    setStep('auth')
    setError(null)
  }

  const connect = async () => {
    if (!selectedPreset || connecting) return
    setConnecting(true)
    setError(null)
    try {
      const effectiveUrl = customUrl.trim() || selectedPreset.baseUrl
      if (selectedPreset.authType === 'api-key' && !credential.trim()) {
        setError('Informe a chave de API.')
        setConnecting(false)
        return
      }
      if (selectedPreset.id === 'other' && !effectiveUrl) {
        setError('Informe o endereço do serviço.')
        setConnecting(false)
        return
      }
      const config: ProviderConfigurationInput = {
        providerType: 'openai-compatible',
        displayName: selectedPreset.name,
        source: selectedPreset.id === 'ollama' ? 'local' : 'remote',
        baseUrl: effectiveUrl,
        enabled: true,
        requiresAuthentication: selectedPreset.authType === 'api-key',
        timeoutMs: 30_000,
      }
      const saved = await window.nocturne.providers.create(config, credential || undefined)
      await window.nocturne.models.refresh(saved.id)
      const catalog = await window.nocturne.models.list()
      const available = catalog.filter((m) => m.providerId === saved.id)
      setModels(available)
      setServices((current) => [saved, ...current])
      if (available.length > 0) {
        setSelectedModel({ providerId: saved.id, modelId: available[0].modelId })
      }
      setStep('model')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setConnecting(false)
    }
  }

  const saveAndBind = async () => {
    if (!selectedPreset || !selectedModel || saving) return
    setSaving(true)
    setError(null)
    try {
      if (workspaceId) {
        await window.nocturne.models.setBindings({
          workspaceId,
          defaultBinding: selectedModel,
        })
      }
      onNotify(`Usando ${selectedModel.modelId}.`)
      resetWizard()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (confirmRemove !== id) { setConfirmRemove(id); return }
    setRemovingId(id)
    setError(null)
    try {
      await window.nocturne.providers.remove(id)
      setServices((current) => current.filter((item) => item.id !== id))
      setConfirmRemove(null)
      onNotify('Conexão removida.')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setRemovingId(null)
    }
  }

  return <div className="ai-page">
    {error && <div className="provider-feedback error" role="alert">{error}</div>}

    {step === 'list' && <>
      <div className="ai-list-header">
        <h4 className="ai-list-heading">Conectar IA</h4>
        <p className="ai-list-sub">Escolha sua inteligência preferida para começar.</p>
      </div>

      {services.length > 0 && <div className="ai-list-connections">
        {services.map((service) => (
          <div key={service.id} className="ai-list-row">
            <div className="ai-list-row-info">
              <span className="ai-list-dot"/>
              <strong>{service.displayName}</strong>
            </div>
            <div className="ai-list-row-actions">
              <button
                className="ai-list-remove"
                aria-label={`Remover ${service.displayName}`}
                disabled={removingId === service.id}
                onClick={() => void remove(service.id)}
              >{removingId === service.id ? <LoaderCircle className="spin" size={13}/> : <Trash2 size={13}/>}</button>
            </div>
          </div>
        ))}
      </div>}

      <button className="ai-add-btn" onClick={() => setStep('service')}>
        <Plus size={16}/> Adicionar IA
      </button>
    </>}

    {step === 'service' && <div className="ai-step-box">
      <div className="ai-step-top">
        <button className="ai-step-back" aria-label="Voltar" onClick={() => setStep('list')}><ArrowLeft size={16}/></button>
        <div className="ai-step-copy"><strong>Escolher IA</strong><small>Selecione o serviço que deseja conectar.</small></div>
      </div>
      <div className="ai-service-list">
        {presets.map((preset) => {
          const Icon = preset.icon
          return <button key={preset.id} className="ai-service-opt" onClick={() => pickService(preset)}>
            <span className="ai-service-mark"><Icon size={17}/></span>
            <span className="ai-service-name">{preset.name}</span>
            <ArrowLeft className="ai-service-arrow" size={14}/>
          </button>
        })}
      </div>
    </div>}

    {step === 'auth' && selectedPreset && <div className="ai-auth">
      <button type="button" className="ai-auth-back" onClick={() => setStep('service')}>
        <ArrowLeft size={14}/> {selectedPreset.name}
      </button>
      <p className="ai-auth-desc">{
        selectedPreset.authType === 'local'
          ? `Conecte seu servidor ${selectedPreset.name} local.`
          : selectedPreset.id === 'other'
            ? 'Informe a chave de API e o endereço do serviço.'
            : `Conecte sua conta ${selectedPreset.name}. Cole sua chave de API para listar os modelos disponíveis.`
      }</p>

      {selectedPreset.authType === 'api-key' && <>
        <input
          className="ai-input"
          type="password"
          autoComplete="new-password"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder={
            selectedPreset.id === 'openai'
              ? 'Ex.: sk-proj-...'
              : selectedPreset.id === 'deepseek'
                ? 'Ex.: sk-...'
                : selectedPreset.id === 'openrouter'
                  ? 'Ex.: sk-or-v1-...'
                  : selectedPreset.id === 'other'
                    ? 'Cole sua chave de API'
                    : 'Chave de API'
          }
        />
        {selectedPreset.id === 'other' && (
          <input
            className="ai-input"
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://api.exemplo.com/v1"
          />
        )}
        {selectedPreset.id !== 'other' && (
          <div className="ai-advanced">
            <button type="button" className="ai-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              <ChevronDown size={11} className={`ai-chevron${showAdvanced ? ' open' : ''}`}/>
              Configuração avançada
            </button>
            {showAdvanced && (
              <input
                className="ai-input"
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="URL personalizada (opcional)"
              />
            )}
          </div>
        )}
      </>}

      {selectedPreset.authType === 'local' && (
        <p className="ai-local-note">
          Certifique-se de que o {selectedPreset.name} está em execução e tente conectar.
        </p>
      )}

      <button className="ai-connect-btn" disabled={connecting} onClick={() => void connect()}>
        {connecting ? <><LoaderCircle className="spin" size={15}/> Conectando…</> : 'Conectar'}
      </button>
    </div>}

    {step === 'model' && selectedPreset && <div className="ai-step-box">
      <div className="ai-step-top">
        <button className="ai-step-back" aria-label="Voltar" onClick={() => setStep('auth')}><ArrowLeft size={16}/></button>
        <div className="ai-step-copy"><strong>Escolher modelo</strong><small>Selecione qual modelo utilizar.</small></div>
      </div>
      <div className="ai-step-body">
        {connecting
          ? <div className="ai-searching"><LoaderCircle className="spin" size={20}/><span>Buscando modelos…</span></div>
          : <>
              {models.length === 0
                ? <p className="ai-no-models">Nenhum modelo encontrado.</p>
                : <div className="ai-model-list">{models.map((m) => (
                    <button
                      key={`${m.providerId}/${m.modelId}`}
                      className={`ai-model-opt ${selectedModel?.modelId === m.modelId ? 'active' : ''}`}
                      disabled={m.availability !== 'available'}
                      onClick={() => setSelectedModel({ providerId: m.providerId, modelId: m.modelId })}
                    >
                      <Check size={14} className="ai-model-check"/>
                      <span className="ai-model-name">{m.displayName}</span>
                    </button>
                  ))}</div>}
            </>}
      </div>
      <div className="ai-step-foot">
        <button disabled={saving || !selectedModel} className="ai-use-btn" onClick={() => void saveAndBind()}>
          {saving ? 'Salvando…' : 'Usar este modelo'}
        </button>
      </div>
    </div>}

    {confirmRemove && <div className="modal-backdrop" onMouseDown={() => setConfirmRemove(null)}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Confirmar remoção">
        <p>Remover esta conexão?</p>
        <div className="modal-actions">
          <button onClick={() => setConfirmRemove(null)}>Cancelar</button>
          <button className="danger" onClick={() => void remove(confirmRemove)}>Remover</button>
        </div>
      </div>
    </div>}
  </div>
}
