import { useState } from 'react'
import { Brain, Check, Copy, ExternalLink, Eye, FolderOpen, MoonStar, X } from 'lucide-react'
import type { CodexSettings, FilePreview, WorkspaceMemory } from '../../types'
import { errorMessage, formatBytes, relativeTime, statusText } from '../../shared/format'
import { useDialogA11y } from '../../shared/useDialogA11y'
import { SafeMarkdown } from '../../shared/SafeMarkdown'

export function OnboardingDialog({ settings, status, hasWorkspace, onWorkspace, onClose }: { settings: CodexSettings; status: string; hasWorkspace: boolean; onWorkspace(): void; onClose(): void }) {
  const [step, setStep] = useState(0)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)
  const items = [
    { title: 'Codex CLI', ok: Boolean(settings.codexCompatible), body: settings.codexVersion && !settings.codexVersion.includes('indisponível') ? `${settings.codexVersion} · ${settings.codexCompatibilityMessage || 'compatibilidade não verificada'}` : 'Codex CLI não encontrado.', fix: 'Instale ou atualize o Codex CLI e confirme com: codex --version' },
    { title: 'Autenticação', ok: Boolean(settings.authenticated), body: settings.authStatus || 'Não foi possível verificar o login.', fix: 'Execute no terminal: codex login' },
    { title: 'App Server', ok: ['ready', 'completed'].includes(status), body: `Estado atual: ${statusText(status)}.`, fix: 'Abra Configurações → Diagnóstico e use Reiniciar Codex.' },
    { title: 'Primeiro workspace', ok: hasWorkspace, body: hasWorkspace ? 'Workspace selecionado e pronto.' : 'Escolha a pasta do primeiro projeto. O agente ficará limitado a essa raiz.', fix: 'Selecione uma pasta de projeto local.' },
    { title: 'Aprovações e segurança', ok: true, body: 'Review apenas sugere; Build pode modificar. Revise comandos sensíveis antes de aprovar.', fix: '' },
  ]
  const current = items[step]
  return <div className="modal-backdrop"><div ref={dialogRef} className="settings-dialog onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" tabIndex={-1}>
    <div className="modal-title"><MoonStar size={18}/><strong id="onboarding-title">Bem-vindo ao Nocturne Codex</strong><button onClick={onClose}>Pular</button></div>
    <div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={items.length} aria-valuenow={step + 1} aria-label="Progresso da configuração">{items.map((_, index) => <span key={index} className={index <= step ? 'active' : ''}/>)}</div>
    <div className={`onboarding-check ${current.ok ? 'ok' : 'failed'}`} aria-hidden="true">{current.ok ? <Check size={18}/> : <X size={18}/>}</div><h2>{current.title}</h2><p>{current.body}</p>
    {!current.ok && current.fix && <code className="onboarding-fix">{current.fix}</code>}{step === 3 && !hasWorkspace && <button className="onboarding-workspace" onClick={onWorkspace}><FolderOpen size={15}/>Escolher workspace</button>}
    <div className="modal-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button><button className="primary" onClick={() => step === items.length - 1 ? onClose() : setStep(step + 1)}>{step === items.length - 1 ? 'Começar' : 'Continuar'}</button></div>
  </div></div>
}

export function MemoryDialog({ value, onClose, onSave }: { value: WorkspaceMemory; onClose(): void; onSave(content: string, rules: string): void }) {
  const [content, setContent] = useState(value.content)
  const [rules, setRules] = useState(value.rules)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)
  return <div className="modal-backdrop" onMouseDown={onClose}><div ref={dialogRef} className="settings-dialog memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-title"><Brain size={17}/><strong id="memory-title">Contexto do workspace</strong><button aria-label="Fechar contexto" title="Fechar" onClick={onClose}><X size={16}/></button></div>
    <p className="memory-description">Arquivos reais em <b>.nocturne/</b>, enviados ao Codex em cada novo turno.</p>{value.project && <div className="project-summary"><strong>{value.project.name}</strong><small>{value.project.primaryLanguage} · {value.project.stack.join(', ') || 'Stack não detectada'}</small></div>}
    <label>Memória e decisões<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000}/></label><label>Regras e padrões<textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={20_000}/></label>
    <div className="memory-footer"><small>{(content.length + rules.length).toLocaleString()} caracteres · {value.updatedAt ? `Atualizada ${relativeTime(value.updatedAt)}` : 'Ainda não salva'}</small><div className="modal-actions"><button onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(content, rules)}>Salvar contexto</button></div></div>
  </div></div>
}

export function PreviewDialog({ preview, activeId, onClose, onError }: { preview: FilePreview; activeId: string | null; onClose(): void; onError(value: string): void }) {
  const dialogRef = useDialogA11y<HTMLElement>(onClose)
  const open = async (action: 'editor' | 'folder') => { if (!activeId || !preview.filePath) return; try { await window.nocturne.files.open(activeId, preview.filePath, action) } catch (error) { onError(errorMessage(error)) } }
  const copy = async () => { try { await window.nocturne.clipboard.writeText(preview.content) } catch (error) { onError(errorMessage(error)) } }
  return <div className="preview-backdrop" onMouseDown={onClose}><section ref={dialogRef} className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><Eye size={16}/><span><strong id="preview-title">{preview.name}</strong><small>{formatBytes(preview.size)}{preview.filePath && ` · ${preview.filePath}`}</small></span></div><div>{preview.kind !== 'image' && <button onClick={copy} aria-label="Copiar conteúdo" title="Copiar conteúdo"><Copy size={15}/></button>}{preview.filePath && <><button onClick={() => open('folder')} aria-label="Abrir pasta" title="Abrir pasta"><FolderOpen size={15}/></button><button onClick={() => open('editor')} aria-label="Abrir arquivo" title="Abrir arquivo"><ExternalLink size={15}/></button></>}<button onClick={onClose} aria-label="Fechar visualização" title="Fechar"><X size={17}/></button></div></header>
    <div className={`preview-content ${preview.kind}`}>{preview.kind === 'image' ? <img src={preview.content} alt={preview.name}/> : preview.kind === 'markdown' ? <SafeMarkdown>{preview.content}</SafeMarkdown> : <pre><code>{preview.content}</code></pre>}</div>
  </section></div>
}
