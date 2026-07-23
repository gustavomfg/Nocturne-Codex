import { useEffect, useState, type ReactNode } from 'react'
import { Activity, Bot, Boxes, Folder, Monitor, Server, Settings, Star, X, type LucideIcon } from 'lucide-react'
import type { AgentMode, CodexSettings, Workspace } from '../../types'
import { errorMessage, isBusy, statusText } from '../../shared/format'
import { useDialogA11y } from '../../shared/useDialogA11y'
import { ProviderSettingsPage } from './ProviderSettingsPage'
import { ModelSettingsPage } from './ModelSettingsPage'

type SettingsPage = 'models' | 'providers' | 'codex' | 'workspace' | 'application' | 'diagnostics'

const settingsPages: Array<{ id: SettingsPage; label: string; description: string; icon: LucideIcon }> = [
  { id: 'models', label: 'Modelos', description: 'Escolhas do workspace', icon: Boxes },
  { id: 'providers', label: 'Providers', description: 'Conexões de IA', icon: Server },
  { id: 'codex', label: 'Codex CLI', description: 'Integração opcional', icon: Bot },
  { id: 'workspace', label: 'Workspaces', description: 'Projetos recentes', icon: Folder },
  { id: 'application', label: 'Aplicativo', description: 'Aparência e uso', icon: Monitor },
  { id: 'diagnostics', label: 'Diagnóstico', description: 'Status e manutenção', icon: Activity },
]

export function SettingsDialog({ value, status, workspace, workspaces, onClose, onSave, onNotify, onOnboarding }: { value: CodexSettings; status: string; workspace: string; workspaces: Workspace[]; onClose(): void; onSave(value: CodexSettings): void | Promise<void>; onNotify(message: string): void; onOnboarding(): void }) {
  const [form, setForm] = useState(value)
  const [page, setPage] = useState<SettingsPage>('models')
  const [diagnostic, setDiagnostic] = useState('Abra esta seção para carregar o diagnóstico.')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)
  const [discardAction, setDiscardAction] = useState<'close' | 'onboarding' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [providerDirty, setProviderDirty] = useState(false)
  const [modelDirty, setModelDirty] = useState(false)
  const settingsDirty = editableSettings(form) !== editableSettings(value)
  const dirty = settingsDirty || providerDirty || modelDirty
  const requestExit = (action: 'close' | 'onboarding' = 'close') => { if (dirty && !saving) setDiscardAction(action); else if (action === 'onboarding') onOnboarding(); else onClose() }
  const confirmDiscard = () => { const action = discardAction; setDiscardAction(null); if (action === 'onboarding') onOnboarding(); else onClose() }
  const dialogRef = useDialogA11y<HTMLDivElement>(() => requestExit())
  useEffect(() => {
    if (page !== 'diagnostics') return
    setDiagnostic('Carregando diagnóstico…')
    void window.nocturne.codex.diagnostics().then((item) => setDiagnostic(`PID: ${item.pid ?? '—'} · ${item.executable}\nÚltima falha: ${item.lastFailure || 'nenhuma'}`)).catch((error) => setDiagnostic(errorMessage(error)))
  }, [page])
  const save = async () => { if (saving) return; setSaving(true); setSaveError(null); try { await onSave(form) } catch (error) { setSaveError(errorMessage(error)) } finally { setSaving(false) } }
  const runOperation = async (name: string, operationTask: () => Promise<string | null | void>, success: string) => {
    if (operation) return
    setOperation(name)
    try { const result = await operationTask(); if (result !== null) onNotify(success) }
    catch (error) { setDiagnostic(errorMessage(error)) }
    finally { setOperation(null) }
  }
  const currentPage = settingsPages.find((item) => item.id === page) ?? settingsPages[0]

  return <div className="modal-backdrop settings-backdrop" onMouseDown={() => requestExit()}>
    <div ref={dialogRef} className="settings-dialog beta-settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <header className="settings-header"><div className="settings-heading"><span><Settings size={17}/></span><div><strong id="settings-title">Configurações</strong><small>Personalize sua experiência no Nocturne</small></div></div><button className="settings-close" aria-label="Fechar configurações" title="Fechar" onClick={() => requestExit()}><X size={17}/></button></header>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Seções das configurações">
          {settingsPages.map((item) => { const Icon = item.icon; const blocked = (providerDirty && page === 'providers' && item.id !== 'providers') || (modelDirty && page === 'models' && item.id !== 'models'); return <button key={item.id} className={page === item.id ? 'active' : ''} aria-label={item.label} aria-current={page === item.id ? 'page' : undefined} disabled={blocked} title={blocked ? 'Salve ou cancele as alterações desta seção.' : undefined} onClick={() => setPage(item.id)}><Icon size={17}/><span><strong>{item.label}</strong><small>{item.description}</small></span></button> })}
        </nav>
        <main className="settings-content">
          <div className="settings-page-title"><span><currentPage.icon size={19}/></span><div><h2>{currentPage.label}</h2><p>{currentPage.description}</p></div></div>
          {page === 'models' && <ModelSettingsPage workspaceId={workspace} onDirtyChange={setModelDirty} onNotify={onNotify}/>}
          {page === 'codex' && <SettingsSection title="Integração Codex CLI"><div className="codex-info"><span className={`status-dot ${status}`}/><div><strong>{statusText(status)}</strong><small>{value.codexVersion || 'Versão indisponível'} · {value.authenticated ? 'Autenticado' : 'Login necessário'}</small></div></div><label>Executável<input value={form.codexPath || ''} onChange={(event) => setForm({ ...form, codexPath: event.target.value })} placeholder="codex ou caminho absoluto"/></label><label>Modelo legado<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Padrão da integração Codex"/></label><div className="settings-columns"><label>Sandbox<select value={form.sandbox} onChange={(event) => setForm({ ...form, sandbox: event.target.value as CodexSettings['sandbox'] })}><option value="read-only">Somente leitura</option><option value="workspace-write">Escrita no workspace</option></select></label><label>Aprovações<select value={form.approvalPolicy} onChange={(event) => setForm({ ...form, approvalPolicy: event.target.value as CodexSettings['approvalPolicy'] })}><option value="untrusted">Não confiáveis</option><option value="on-request">Quando solicitado</option></select></label></div></SettingsSection>}
          {page === 'providers' && <ProviderSettingsPage workspaceId={workspace} onDirtyChange={setProviderDirty} onNotify={onNotify}/>}
          {page === 'workspace' && <SettingsSection title="Projetos recentes"><div className="settings-workspaces">{workspaces.slice(0, 6).map((workspace) => <div key={workspace.path}><span className="workspace-setting-icon"><Folder size={15}/></span><span><strong title={workspace.name}>{workspace.name}</strong><small title={workspace.path}>{workspace.path}</small></span>{workspace.favorite && <Star className="workspace-setting-star" size={13} fill="currentColor"/>}</div>)}{!workspaces.length && <p className="settings-empty">Nenhum workspace recente.</p>}</div></SettingsSection>}
          {page === 'application' && <SettingsSection title="Preferências"><div className="settings-columns"><label>Tema<select value="dark" disabled><option value="dark">Nocturne escuro</option></select></label><label>Modo padrão<select value={form.defaultAgentMode || 'review'} onChange={(event) => setForm({ ...form, defaultAgentMode: event.target.value as AgentMode })}><option value="review">Review</option><option value="build">Build</option><option value="docs">Docs</option></select></label></div><label className="check-label"><input type="checkbox" checked={Boolean(form.diagnosticMode)} onChange={(event) => setForm({ ...form, diagnosticMode: event.target.checked })}/><span><strong>Logs detalhados</strong><small>Registra mais informações para diagnóstico</small></span></label><button className="secondary-setting" onClick={() => requestExit('onboarding')}>Reabrir primeira execução</button></SettingsSection>}
          {page === 'diagnostics' && <SettingsSection title="Informações do sistema"><pre className="diagnostic-summary" aria-live="polite">{diagnostic}</pre><div className="diagnostic-actions"><button disabled={isBusy(status) || Boolean(operation)} title={isBusy(status) ? 'Aguarde ou cancele a execução atual' : 'Reiniciar Codex'} onClick={() => { setDiagnostic('Reiniciando Codex…'); void runOperation('restart', async () => { await window.nocturne.codex.restart(); setDiagnostic('Codex reiniciado com sucesso.') }, 'Codex reiniciado com sucesso.') }}>{operation === 'restart' ? 'Reiniciando…' : 'Reiniciar Codex'}</button><button disabled={Boolean(operation)} onClick={() => void runOperation('logs', () => window.nocturne.diagnostics.openLogs(), 'Pasta de logs aberta.')}>Abrir logs</button><button disabled={Boolean(operation)} onClick={() => void runOperation('copy', async () => { const content = await window.nocturne.diagnostics.copy(); await window.nocturne.clipboard.writeText(content); setCopied(true) }, 'Informações de diagnóstico copiadas.')}>{operation === 'copy' ? 'Copiando…' : copied ? 'Informações copiadas' : 'Copiar informações'}</button><button disabled={Boolean(operation)} onClick={() => void runOperation('export', () => window.nocturne.data.export(), 'Backup exportado com sucesso.')}>{operation === 'export' ? 'Exportando…' : 'Exportar dados'}</button></div></SettingsSection>}
        </main>
      </div>
      <footer className={`settings-footer ${discardAction ? 'confirm-discard' : ''} ${saveError ? 'has-error' : ''}`}>{discardAction ? <><span role="alert"><strong>Descartar alterações?</strong> Os campos editados ainda não foram salvos.</span><div className="modal-actions"><button onClick={() => setDiscardAction(null)}>Continuar editando</button><button className="danger" onClick={confirmDiscard}>Descartar</button></div></> : <><span role={saveError ? 'alert' : undefined}>{saveError || (providerDirty ? 'Salve ou cancele a edição do Provider.' : modelDirty ? 'Salve os bindings antes de sair desta seção.' : settingsDirty ? 'Existem alterações não salvas.' : 'Nenhuma alteração pendente.')}</span><div className="modal-actions"><button disabled={saving} onClick={() => requestExit()}>Cancelar</button><button className="primary" disabled={saving || !settingsDirty} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div></>}</footer>
    </div>
  </div>
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) { return <section className="settings-section"><h3>{title}</h3>{children}</section> }

function editableSettings(value: CodexSettings) {
  return JSON.stringify({ model: value.model || '', sandbox: value.sandbox, approvalPolicy: value.approvalPolicy, codexPath: value.codexPath || '', diagnosticMode: Boolean(value.diagnosticMode), theme: value.theme || 'dark', defaultAgentMode: value.defaultAgentMode || 'review' })
}
