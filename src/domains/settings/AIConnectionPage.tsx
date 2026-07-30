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
  UserRound,
} from 'lucide-react'
import type {
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../../../shared/ai/providerConfiguration'
import type { ModelDescriptor, ModelReference } from '../../../shared/ai/model'
import type { CodexAccountStatus } from '../../../shared/types'
import { errorMessage } from '../../shared/format'

type Step = 'list' | 'service' | 'auth' | 'model'

interface ServicePreset {
  id: string
  name: string
  icon: typeof Bot
  baseUrl: string
  authType: 'account' | 'api-key' | 'local'
}

const presets: ServicePreset[] = [
  { id: 'codex', name: 'Conta ChatGPT', icon: UserRound, baseUrl: '', authType: 'account' },
  { id: 'openai', name: 'OpenAI API', icon: Sparkles, baseUrl: 'https://api.openai.com/v1', authType: 'api-key' },
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
  const [codexAccount, setCodexAccount] = useState<CodexAccountStatus | null>(null)
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
    void Promise.all([
      window.nocturne.providers.list(),
      window.nocturne.codex.status(),
    ])
      .then(([items, account]) => {
        if (!active) return
        setServices(items)
        setCodexAccount(account)
      })
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
      if (selectedPreset.authType === 'account') {
        const account = await window.nocturne.codex.login()
        setCodexAccount(account)
        onNotify('Conta ChatGPT conectada pelo Codex CLI.')
        resetWizard()
        return
      }
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

  const disconnectCodex = async () => {
    if (connecting) return
    setConnecting(true)
    setError(null)
    try {
      setCodexAccount(await window.nocturne.codex.logout())
      onNotify('Conta ChatGPT desconectada do Codex CLI.')
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
        <p className="ai-list-sub">Use sua conta ChatGPT pelo Codex CLI, uma chave de API ou um modelo local.</p>
      </div>

      {(codexAccount?.authenticated || services.length > 0) && <div className="ai-list-connections">
        {codexAccount?.authenticated && <div className="ai-list-row">
          <div className="ai-list-row-info">
            <span className="ai-list-dot"/>
            <span><strong>Conta ChatGPT</strong><small>Codex CLI {codexAccount.version}</small></span>
          </div>
          <div className="ai-list-row-actions">
            <button
              className="ai-list-remove"
              aria-label="Desconectar conta ChatGPT"
              disabled={connecting}
              onClick={() => void disconnectCodex()}
            >{connecting ? <LoaderCircle className="spin" size={13}/> : <Trash2 size={13}/>}</button>
          </div>
        </div>}
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
        <Plus size={16}/> Adicionar conta, API ou modelo local
      </button>
    </>}

    {step === 'service' && <div className="ai-step-box">
      <div className="ai-step-top">
        <button className="ai-step-back" aria-label="Voltar" onClick={() => setStep('list')}><ArrowLeft size={16}/></button>
        <div className="ai-step-copy"><strong>Escolher acesso</strong><small>Assinatura ChatGPT e APIs são conexões diferentes.</small></div>
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
        selectedPreset.authType === 'account'
          ? 'O navegador será aberto pelo Codex CLI. Uma assinatura ChatGPT compatível pode ser usada aqui, sem expor credenciais ao aplicativo.'
          : selectedPreset.authType === 'local'
          ? `Conecte seu servidor ${selectedPreset.name} local.`
          : selectedPreset.id === 'other'
            ? 'Informe a chave de API e o endereço do serviço.'
            : `Cole sua chave de ${selectedPreset.name}. A cobrança da API é separada de planos mensais de chat.`
      }</p>

      {selectedPreset.authType === 'account' && codexAccount && !codexAccount.installed && (
        <p className="ai-local-note">O Codex CLI 0.145.0 precisa estar instalado para usar uma conta ChatGPT.</p>
      )}
      {selectedPreset.authType === 'account' && codexAccount?.installed && !codexAccount.compatible && (
        <p className="ai-local-note">Codex CLI {codexAccount.version || 'desconhecido'} não homologado. Instale a versão 0.145.0.</p>
      )}

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

      <button
        className="ai-connect-btn"
        disabled={connecting || (selectedPreset.authType === 'account' && (!codexAccount?.installed || !codexAccount.compatible))}
        onClick={() => void connect()}
      >
        {connecting
          ? <><LoaderCircle className="spin" size={15}/> Conectando…</>
          : selectedPreset.authType === 'account' ? 'Entrar com ChatGPT' : 'Conectar'}
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
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Confirmar remoção" onMouseDown={(event) => event.stopPropagation()}>
        <p>Remover esta conexão?</p>
        <div className="modal-actions">
          <button onClick={() => setConfirmRemove(null)}>Cancelar</button>
          <button className="danger" onClick={() => void remove(confirmRemove)}>Remover</button>
        </div>
      </div>
    </div>}
  </div>
}
