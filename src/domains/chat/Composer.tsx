import type { FormEvent, RefObject } from 'react'
import { Code2, FileCode2, GitBranch, Paperclip, Send, ShieldCheck, Square, X } from 'lucide-react'
import type { AgentMode, Attachment, CodexSettings } from '../../types'
import { isBusy } from '../../shared/format'

interface ComposerProps {
  agentMode: AgentMode; attachments: Attachment[]; prompt: string; status: string; settings: CodexSettings; active: boolean; composerRef: RefObject<HTMLTextAreaElement>;
  onMode(mode: AgentMode): void; onPrompt(value: string): void; onRemoveAttachment(path: string): void; onAttach(): void; onCancel(): void; onSubmit(event: FormEvent<HTMLFormElement>): void; onQuick(prompt: string, mode?: AgentMode): void
}

export function Composer({ agentMode, attachments, prompt, status, settings, active, composerRef, onMode, onPrompt, onRemoveAttachment, onAttach, onCancel, onSubmit, onQuick }: ComposerProps) {
  const busy = isBusy(status)
  return <div className="composer-wrap"><div className="agent-mode-switch" aria-label="Modo do agente"><button type="button" className={agentMode === 'build' ? 'active' : ''} onClick={() => onMode('build')}><span/>Build <small>Pode modificar</small></button><button type="button" className={agentMode === 'review' ? 'active' : ''} onClick={() => onMode('review')}><span/>Review <small>Apenas sugere</small></button><button type="button" className={agentMode === 'docs' ? 'active' : ''} onClick={() => onMode('docs')}><span/>Docs <small>Foco documentação</small></button></div><div className="quick-actions"><button onClick={() => onQuick('Analise este projeto e resuma arquitetura, dependências, riscos e próximos passos.')}><Code2 size={11}/>Analisar</button><button onClick={() => onQuick('Crie documentação completa em Markdown para este projeto e salve em DOCUMENTACAO.md.', 'docs')}><FileCode2 size={11}/>Documentar</button><button onClick={() => onQuick('Revise as alterações Git atuais, buscando bugs, riscos e testes ausentes. Não modifique arquivos sem pedir.', 'review')}><GitBranch size={11}/>Revisar diff</button></div><form className="composer" onSubmit={onSubmit}>
    {!!attachments.length && <div className="attachment-list">{attachments.map((item) => <span key={item.path}><Paperclip size={11}/>{item.name}<button type="button" aria-label={`Remover anexo ${item.name}`} title="Remover anexo" onClick={() => onRemoveAttachment(item.path)}><X size={11}/></button></span>)}</div>}
    <textarea ref={composerRef} value={prompt} onChange={(event) => onPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder={active ? 'Peça ao Codex para criar, analisar ou modificar...' : 'Selecione um workspace e descreva o que deseja criar...'} rows={1}/>
    <div className="composer-bottom"><div className="composer-tools"><button type="button" aria-label="Anexar arquivo" title="Anexar arquivo" onClick={onAttach}><Paperclip size={16}/></button><span><ShieldCheck size={14}/> {settings.sandbox}</span></div><button type={busy ? 'button' : 'submit'} aria-label={busy ? 'Cancelar execução' : 'Enviar mensagem'} title={busy ? 'Cancelar execução' : 'Enviar mensagem'} onClick={busy && status !== 'cancelling' ? onCancel : undefined} className={`send-button ${busy ? 'stop' : ''}`} disabled={status === 'cancelling' || (!prompt.trim() && !busy)}>{busy ? <Square size={14} fill="currentColor"/> : <Send size={16}/>}</button></div>
  </form><small className="composer-hint">Enter para enviar · Shift + Enter para nova linha</small></div>
}
