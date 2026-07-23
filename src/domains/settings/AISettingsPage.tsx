import { useState } from 'react'
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { CodexSettings } from '../../types'
import { statusText } from '../../shared/format'
import { ModelSettingsPage } from './ModelSettingsPage'
import { ProviderSettingsPage } from './ProviderSettingsPage'

interface AISettingsPageProps {
  value: CodexSettings
  form: CodexSettings
  status: string
  workspaceId: string
  onChange(value: CodexSettings): void
  onProviderDirtyChange(dirty: boolean): void
  onModelDirtyChange(dirty: boolean): void
  onNotify(message: string): void
  onRecheck(): Promise<void>
}

export function AISettingsPage({
  value,
  form,
  status,
  workspaceId,
  onChange,
  onProviderDirtyChange,
  onModelDirtyChange,
  onNotify,
  onRecheck,
}: AISettingsPageProps) {
  const [checking, setChecking] = useState(false)
  const connected = Boolean(value.authenticated && value.codexCompatible)

  const recheck = async () => {
    if (checking) return
    setChecking(true)
    try {
      await onRecheck()
    } finally {
      setChecking(false)
    }
  }

  return <div className="ai-settings">
    <section className={`ai-account-card ${connected ? 'connected' : 'attention'}`} aria-labelledby="ai-account-title">
      <div className="ai-account-icon"><Bot size={20}/></div>
      <div className="ai-account-copy">
        <div className="ai-account-heading">
          <div>
            <strong id="ai-account-title">Conta ChatGPT</strong>
            <small>Usa sua assinatura pelo fluxo oficial do Codex CLI.</small>
          </div>
          <span>{connected ? <CheckCircle2 size={13}/> : <CircleAlert size={13}/>}
            {connected ? 'Conectada' : 'Ação necessária'}
          </span>
        </div>
        <p>{connected
          ? `${value.codexVersion || 'Codex CLI'} · ${statusText(status)}`
          : value.authStatus || 'Entre com sua conta ChatGPT para usar o agente completo.'}
        </p>
        {!value.authenticated && <div className="ai-login-instruction">
          <KeyRound size={15}/>
          <span><strong>Entre pelo terminal</strong><code>codex login</code></span>
        </div>}
        {!value.codexCompatible && <p className="ai-account-warning">
          Instale ou atualize uma versão compatível do Codex CLI antes de entrar.
        </p>}
      </div>
      <button className="ai-recheck" disabled={checking} onClick={() => void recheck()}>
        <RefreshCw className={checking ? 'spin' : undefined} size={15}/>
        {checking ? 'Verificando…' : 'Verificar acesso'}
      </button>
    </section>

    <section className="ai-api-section" aria-labelledby="ai-api-title">
      <div className="ai-section-heading">
        <div className="ai-section-icon"><KeyRound size={18}/></div>
        <div>
          <strong id="ai-api-title">Chave de API</strong>
          <small>Conecte uma API própria. A cobrança é separada de assinaturas mensais.</small>
        </div>
      </div>
      <div className="ai-capability-note">
        <ShieldCheck size={15}/>
        <span>Conexões por API executam conversa e análise. Ferramentas, alterações e aprovações continuam disponíveis somente pelo agente Codex completo.</span>
      </div>
      <ProviderSettingsPage
        workspaceId={workspaceId}
        onDirtyChange={onProviderDirtyChange}
        onNotify={onNotify}
      />
    </section>

    <section className="ai-workspace-section" aria-labelledby="ai-workspace-title">
      <div className="ai-section-heading">
        <div className="ai-section-icon"><ShieldCheck size={18}/></div>
        <div>
          <strong id="ai-workspace-title">Uso neste workspace</strong>
          <small>Ative explicitamente uma conexão por API para o projeto atual.</small>
        </div>
      </div>
      <ModelSettingsPage
        workspaceId={workspaceId}
        onDirtyChange={onModelDirtyChange}
        onNotify={onNotify}
      />
    </section>

    <details className="ai-agent-advanced">
      <summary>Configuração avançada do agente Codex</summary>
      <div>
        <label>Executável<input value={form.codexPath || ''} onChange={(event) => onChange({ ...form, codexPath: event.target.value })} placeholder="codex ou caminho absoluto"/></label>
        <label>Modelo do agente<input value={form.model} onChange={(event) => onChange({ ...form, model: event.target.value })} placeholder="Padrão do Codex"/></label>
        <div className="settings-columns">
          <label>Sandbox<select value={form.sandbox} onChange={(event) => onChange({ ...form, sandbox: event.target.value as CodexSettings['sandbox'] })}><option value="read-only">Somente leitura</option><option value="workspace-write">Escrita no workspace</option></select></label>
          <label>Aprovações<select value={form.approvalPolicy} onChange={(event) => onChange({ ...form, approvalPolicy: event.target.value as CodexSettings['approvalPolicy'] })}><option value="untrusted">Não confiáveis</option><option value="on-request">Quando solicitado</option></select></label>
        </div>
      </div>
    </details>
  </div>
}
