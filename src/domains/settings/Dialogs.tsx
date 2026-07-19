import { useState } from 'react'
import { Brain, Check, Copy, ExternalLink, Eye, FolderOpen, MoonStar, RefreshCw, Settings, X } from 'lucide-react'
import type { CodexSettings, FilePreview, WorkspaceMemory } from '../../types'
import { errorMessage, formatBytes, relativeTime, statusText } from '../../shared/format'
import { useDialogA11y } from '../../shared/useDialogA11y'
import { SafeMarkdown } from '../../shared/SafeMarkdown'

export function OnboardingDialog({ settings, status, hasWorkspace, onWorkspace, onSettings, onRecheck, onDismiss, onComplete }: { settings: CodexSettings; status: string; hasWorkspace: boolean; onWorkspace(): void; onSettings(): void; onRecheck(): Promise<void>; onDismiss(): void; onComplete(): void }) {
  const [step, setStep] = useState(0)
  const [checking, setChecking] = useState(false)
  const dialogRef = useDialogA11y<HTMLDivElement>(onDismiss)
  const items = [
    { title: 'Codex CLI', ok: Boolean(settings.codexCompatible), body: settings.codexVersion && !settings.codexVersion.includes('indisponível') ? `${settings.codexVersion} · ${settings.codexCompatibilityMessage || 'compatibilidade não verificada'}` : 'Codex CLI não encontrado.', fix: 'Instale ou atualize o Codex CLI e confirme com: codex --version' },
    { title: 'Autenticação', ok: Boolean(settings.authenticated), body: settings.authStatus || 'Não foi possível verificar o login.', fix: 'Execute no terminal: codex login' },
    { title: 'App Server', ok: ['ready', 'completed'].includes(status), body: `Estado atual: ${statusText(status)}.`, fix: 'Abra Configurações → Diagnóstico e use Reiniciar Codex.' },
    { title: 'Primeiro workspace', ok: hasWorkspace, body: hasWorkspace ? 'Workspace selecionado e pronto.' : 'Escolha a pasta do primeiro projeto. O agente ficará limitado a essa raiz.', fix: 'Selecione uma pasta de projeto local.' },
    { title: 'Aprovações e segurança', ok: true, body: 'Review apenas sugere; Build pode modificar. Revise comandos sensíveis antes de aprovar.', fix: '' },
  ]
  const current = items[step]
  const blockers = items.slice(0, 4).filter((item) => !item.ok).length
  const recheck = async () => { if (checking) return; setChecking(true); try { await onRecheck() } finally { setChecking(false) } }
  return <div className="modal-backdrop"><div ref={dialogRef} className="settings-dialog onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" tabIndex={-1}>
    <div className="modal-title"><MoonStar size={18}/><strong id="onboarding-title">Prontidão do Nocturne</strong><button onClick={onDismiss}>Agora não</button></div>
    <div className={`readiness-summary ${blockers ? 'pending' : 'ready'}`} role="status"><span>{blockers ? `${blockers} etapa(s) precisam de atenção` : 'Ambiente pronto para trabalhar'}</span><small>{blockers ? 'Você pode sair agora; a configuração continuará pendente.' : 'Todas as verificações essenciais foram concluídas.'}</small></div>
    <div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={items.length} aria-valuenow={step + 1} aria-label="Progresso da configuração">{items.map((_, index) => <span key={index} className={index <= step ? 'active' : ''}/>)}</div>
    <div className={`onboarding-check ${current.ok ? 'ok' : 'failed'}`} aria-hidden="true">{current.ok ? <Check size={18}/> : <X size={18}/>}</div><h2>{current.title}</h2><p>{current.body}</p>
    {!current.ok && current.fix && <code className="onboarding-fix">{current.fix}</code>}
    {!current.ok && step < 3 && <div className="onboarding-remediation"><button onClick={onSettings}><Settings size={15}/>Abrir configurações</button><button disabled={checking} onClick={() => void recheck()}><RefreshCw size={15}/>{checking ? 'Verificando…' : 'Verificar novamente'}</button></div>}
    {step === 3 && !hasWorkspace && <button className="onboarding-workspace" onClick={onWorkspace}><FolderOpen size={15}/>Escolher workspace</button>}
    <div className="modal-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button><button className="primary" onClick={() => step === items.length - 1 ? blockers ? setStep(items.findIndex((item, index) => index < 4 && !item.ok)) : onComplete() : setStep(step + 1)}>{step === items.length - 1 ? blockers ? `Revisar ${blockers} pendência(s)` : 'Concluir configuração' : 'Continuar'}</button></div>
  </div></div>
}

export function MemoryDialog({ value, onClose, onOpenBrain, onSave }: { value: WorkspaceMemory; onClose(): void; onOpenBrain(): void; onSave(content: string, rules: string): void | Promise<void> }) {
  const [content, setContent] = useState(value.content)
  const [rules, setRules] = useState(value.rules)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const dirty = content !== value.content || rules !== value.rules
  const requestClose = () => { if (dirty && !saving) setConfirmDiscard(true); else onClose() }
  const save = async () => { if (saving || !dirty) return; setSaving(true); setSaveError(null); try { await onSave(content, rules) } catch (error) { setSaveError(errorMessage(error)) } finally { setSaving(false) } }
  const dialogRef = useDialogA11y<HTMLDivElement>(requestClose)
  return <div className="modal-backdrop" onMouseDown={requestClose}><div ref={dialogRef} className="settings-dialog memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-title"><Brain size={17}/><strong id="memory-title">Contexto do workspace</strong><button aria-label="Fechar contexto" title="Fechar" onClick={requestClose}><X size={16}/></button></div>
    <p className="memory-description">Arquivos reais em <b>.nocturne/</b>, enviados ao Codex em cada novo turno.</p><button disabled={dirty || saving} onClick={onOpenBrain}><Brain size={15}/>Abrir Segundo Cérebro</button>{value.project && <div className="project-summary"><strong>{value.project.name}</strong><small>{value.project.primaryLanguage} · {value.project.stack.join(', ') || 'Stack não detectada'}</small></div>}
    <label>Memória e decisões<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000}/></label><label>Regras e padrões<textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={20_000}/></label>
    <div className={`memory-footer ${confirmDiscard ? 'confirm-discard' : ''} ${saveError ? 'has-error' : ''}`}>{confirmDiscard ? <><span role="alert"><strong>Descartar alterações?</strong><small>O contexto editado ainda não foi salvo.</small></span><div className="modal-actions"><button onClick={() => setConfirmDiscard(false)}>Continuar editando</button><button className="danger" onClick={onClose}>Descartar</button></div></> : <><small role={saveError ? 'alert' : undefined}>{saveError || `${(content.length + rules.length).toLocaleString()} caracteres · ${value.updatedAt ? `Atualizada ${relativeTime(value.updatedAt)}` : 'Ainda não salva'}`}</small><div className="modal-actions"><button disabled={saving} onClick={requestClose}>Cancelar</button><button className="primary" disabled={saving || !dirty} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar contexto'}</button></div></>}</div>
  </div></div>
}

export function PreviewDialog({ preview, activeId, onClose, onError, onNotify }: { preview: FilePreview; activeId: string | null; onClose(): void; onError(value: string): void; onNotify(value: string): void }) {
  const dialogRef = useDialogA11y<HTMLElement>(onClose)
  const [copying, setCopying] = useState(false)
  const open = async (action: 'editor' | 'folder') => { if (!activeId || !preview.filePath) return; try { await window.nocturne.files.open(activeId, preview.filePath, action); onNotify(action === 'folder' ? 'Pasta do arquivo aberta.' : 'Arquivo aberto no editor.') } catch (error) { onError(errorMessage(error)) } }
  const copy = async () => { if (copying) return; setCopying(true); try { await window.nocturne.clipboard.writeText(preview.content); onNotify('Conteúdo copiado.') } catch (error) { onError(errorMessage(error)) } finally { setCopying(false) } }
  return <div className="preview-backdrop" onMouseDown={onClose}><section ref={dialogRef} className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><Eye size={16}/><span><strong id="preview-title">{preview.name}</strong><small>{formatBytes(preview.size)}{preview.filePath && ` · ${preview.filePath}`}</small></span></div><div>{preview.kind !== 'image' && <button disabled={copying} onClick={() => void copy()} aria-label={copying ? 'Copiando conteúdo' : 'Copiar conteúdo'} title="Copiar conteúdo"><Copy size={15}/></button>}{preview.filePath && <><button onClick={() => void open('folder')} aria-label="Abrir pasta" title="Abrir pasta"><FolderOpen size={15}/></button><button onClick={() => void open('editor')} aria-label="Abrir arquivo" title="Abrir arquivo"><ExternalLink size={15}/></button></>}<button onClick={onClose} aria-label="Fechar visualização" title="Fechar"><X size={17}/></button></div></header>
    <div className={`preview-content ${preview.kind}`}>{preview.kind === 'image' ? <img src={preview.content} alt={preview.name}/> : preview.kind === 'markdown' ? <SafeMarkdown>{preview.content}</SafeMarkdown> : <pre><code>{preview.content}</code></pre>}</div>
  </section></div>
}
