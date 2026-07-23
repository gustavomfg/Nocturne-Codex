import { useLayoutEffect, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { Code2, FileCode2, GitBranch, Paperclip, Send, ShieldCheck, Square, X } from 'lucide-react'
import type { AgentMode, Attachment } from '../../types'
import { isBusy } from '../../shared/format'

interface ComposerProps {
  agentMode: AgentMode; attachments: Attachment[]; prompt: string; status: string; finalizing: boolean; active: boolean; pendingApprovals: number; composerRef: RefObject<HTMLTextAreaElement | null>;
  onMode(mode: AgentMode): void; onPrompt(value: string): void; onRemoveAttachment(path: string): void; onAttach(): void; onCancel(): void; onSubmit(event: FormEvent<HTMLFormElement>): void; onQuick(prompt: string, mode?: AgentMode): void
}

const modes: Array<{ id: AgentMode; label: string; description: string }> = [
  { id: 'build', label: 'Build', description: 'Pode modificar' },
  { id: 'review', label: 'Review', description: 'Apenas sugere' },
  { id: 'docs', label: 'Docs', description: 'Foco documentação' },
]

export function Composer({ agentMode, attachments, prompt, status, finalizing, active, pendingApprovals, composerRef, onMode, onPrompt, onRemoveAttachment, onAttach, onCancel, onSubmit, onQuick }: ComposerProps) {
  const busy = isBusy(status) || finalizing
  useLayoutEffect(() => {
    const textarea = composerRef.current
    if (!textarea) return
    if (!prompt) { textarea.style.height = ''; textarea.style.overflowY = 'hidden'; return }
    textarea.style.height = 'auto'
    const maximum = 220
    textarea.style.height = `${Math.min(textarea.scrollHeight, maximum)}px`
    textarea.style.overflowY = textarea.scrollHeight > maximum ? 'auto' : 'hidden'
  }, [composerRef, prompt])
  const moveModeFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + modes.length) % modes.length
    onMode(modes[next].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }
  return <div className={`composer-wrap mode-${agentMode}`}>
    {pendingApprovals > 0 && <div className="approval-notice" role="status"><ShieldCheck size={15}/><span><strong>Aguardando sua aprovação</strong><small>Abra o painel do agente para revisar a solicitação.</small></span></div>}
    <div className="agent-mode-switch" role="radiogroup" aria-label="Modo do agente">{modes.map((mode, index) => <button key={mode.id} type="button" role="radio" aria-checked={agentMode === mode.id} tabIndex={agentMode === mode.id ? 0 : -1} className={agentMode === mode.id ? 'active' : ''} onKeyDown={(event) => moveModeFocus(event, index)} onClick={() => onMode(mode.id)}><span/>{mode.label} <small>{mode.description}</small></button>)}</div>
    <div className="quick-actions" aria-label="Preencher um modelo de pedido"><button type="button" onClick={() => onQuick('Analise este projeto e resuma arquitetura, dependências, riscos e próximos passos.')}><Code2 size={13}/>Preparar análise</button><button type="button" onClick={() => onQuick('Crie documentação completa em Markdown para este projeto e salve em DOCUMENTACAO.md.', 'docs')}><FileCode2 size={13}/>Preparar documentação</button><button type="button" onClick={() => onQuick('Revise as alterações Git atuais, buscando bugs, riscos e testes ausentes. Não modifique arquivos sem pedir.', 'review')}><GitBranch size={13}/>Preparar revisão</button></div>
    <form className="composer" onSubmit={onSubmit}>
      {!!attachments.length && <div className="attachment-list">{attachments.map((item) => <span key={item.path}><Paperclip size={13}/>{item.name}<button type="button" aria-label={`Remover anexo ${item.name}`} title="Remover anexo" onClick={() => onRemoveAttachment(item.path)}><X size={13}/></button></span>)}</div>}
      <label className="sr-only" htmlFor="prompt-composer">Mensagem para o agente</label><textarea id="prompt-composer" ref={composerRef} value={prompt} onChange={(event) => onPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder={active ? 'Descreva o que deseja fazer…' : 'Selecione um workspace e descreva o que deseja criar…'} rows={1}/>
      <div className="composer-bottom"><div className="composer-tools"><button type="button" aria-label="Anexar arquivo" title={busy ? 'Aguarde a execução atual terminar' : 'Anexar arquivo'} onClick={onAttach} disabled={busy}><Paperclip size={16}/></button></div><button type={busy ? 'button' : 'submit'} aria-label={finalizing ? 'Salvando resposta' : busy ? 'Cancelar execução' : 'Enviar mensagem'} title={finalizing ? 'Salvando resposta…' : busy ? 'Cancelar execução' : 'Enviar mensagem'} onClick={busy && !finalizing && status !== 'cancelling' ? onCancel : undefined} className={`send-button ${busy && !finalizing ? 'stop' : ''}`} disabled={finalizing || status === 'cancelling' || (!prompt.trim() && !busy)}>{busy && !finalizing ? <Square size={14} fill="currentColor"/> : <Send size={16}/>}</button></div>
    </form><small className="composer-hint">Enter para enviar · Shift + Enter para nova linha</small>
  </div>
}
