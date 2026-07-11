import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Brain, Check, Copy, ExternalLink, Eye, FolderOpen, MoonStar, X } from 'lucide-react'
import type { CodexSettings, FilePreview, WorkspaceMemory } from '../../types'
import { errorMessage, formatBytes, relativeTime, statusText } from '../../shared/format'

export function OnboardingDialog({ settings, status, hasWorkspace, onWorkspace, onClose }: { settings: CodexSettings; status: string; hasWorkspace: boolean; onWorkspace(): void; onClose(): void }) {
  const [step, setStep] = useState(0)
  const items = [
    { title: 'Codex CLI', ok: Boolean(settings.codexVersion && !settings.codexVersion.includes('indisponível')), body: settings.codexVersion && !settings.codexVersion.includes('indisponível') ? `Encontrado: ${settings.codexVersion}` : 'Codex CLI não encontrado.', fix: 'Instale o Codex CLI e confirme com: codex --version' },
    { title: 'Autenticação', ok: Boolean(settings.authenticated), body: settings.authStatus || 'Não foi possível verificar o login.', fix: 'Execute no terminal: codex login' },
    { title: 'App Server', ok: ['ready', 'completed'].includes(status), body: `Estado atual: ${statusText(status)}.`, fix: 'Abra Configurações → Diagnóstico e use Reiniciar Codex.' },
    { title: 'Primeiro workspace', ok: hasWorkspace, body: hasWorkspace ? 'Workspace selecionado e pronto.' : 'Escolha a pasta do primeiro projeto. O agente ficará limitado a essa raiz.', fix: 'Selecione uma pasta de projeto local.' },
    { title: 'Aprovações e segurança', ok: true, body: 'Review apenas sugere; Build pode modificar. Revise comandos sensíveis antes de aprovar.', fix: '' },
  ]
  const current = items[step]
  return <div className="modal-backdrop"><div className="settings-dialog onboarding-dialog"><div className="modal-title"><MoonStar size={18}/><strong>Bem-vindo ao Nocturne Codex</strong><button onClick={onClose}>Pular</button></div><div className="onboarding-progress">{items.map((_, index) => <span key={index} className={index <= step ? 'active' : ''}/>)}</div><div className={`onboarding-check ${current.ok ? 'ok' : 'failed'}`}>{current.ok ? <Check size={18}/> : <X size={18}/>}</div><h2>{current.title}</h2><p>{current.body}</p>{!current.ok && current.fix && <code className="onboarding-fix">{current.fix}</code>}{step === 3 && !hasWorkspace && <button className="onboarding-workspace" onClick={onWorkspace}><FolderOpen size={15}/>Escolher workspace</button>}<div className="modal-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button><button className="primary" onClick={() => step === items.length - 1 ? onClose() : setStep(step + 1)}>{step === items.length - 1 ? 'Começar' : 'Continuar'}</button></div></div></div>
}

export function MemoryDialog({ value, onClose, onSave }: { value: WorkspaceMemory; onClose(): void; onSave(content: string, rules: string): void }) {
  const [content, setContent] = useState(value.content)
  const [rules, setRules] = useState(value.rules)
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="settings-dialog memory-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><Brain size={17}/><strong>Contexto do workspace</strong><button onClick={onClose}><X size={16}/></button></div><p className="memory-description">Arquivos reais em <b>.nocturne/</b>, enviados ao Codex em cada novo turno.</p>{value.project && <div className="project-summary"><strong>{value.project.name}</strong><small>{value.project.primaryLanguage} · {value.project.stack.join(', ') || 'Stack não detectada'}</small></div>}<label>Memória e decisões<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000}/></label><label>Regras e padrões<textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={20_000}/></label><div className="memory-footer"><small>{(content.length + rules.length).toLocaleString()} caracteres · {value.updatedAt ? `Atualizada ${relativeTime(value.updatedAt)}` : 'Ainda não salva'}</small><div className="modal-actions"><button onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(content, rules)}>Salvar contexto</button></div></div></div></div>
}

export function PreviewDialog({ preview, activeId, onClose, onError }: { preview: FilePreview; activeId: string | null; onClose(): void; onError(value: string): void }) {
  const open = async (action: 'editor' | 'folder') => { if (!activeId || !preview.filePath) return; try { await window.nocturne.files.open(activeId, preview.filePath, action) } catch (error) { onError(errorMessage(error)) } }
  const copy = async () => { try { await navigator.clipboard.writeText(preview.content); } catch (error) { onError(errorMessage(error)) } }
  return <div className="preview-backdrop" onMouseDown={onClose}><section className="preview-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><Eye size={16}/><span><strong>{preview.name}</strong><small>{formatBytes(preview.size)}{preview.filePath && ` · ${preview.filePath}`}</small></span></div><div>{preview.kind !== 'image' && <button onClick={copy} title="Copiar conteúdo"><Copy size={15}/></button>}{preview.filePath && <><button onClick={() => open('folder')} title="Abrir pasta"><FolderOpen size={15}/></button><button onClick={() => open('editor')} title="Abrir arquivo"><ExternalLink size={15}/></button></>}<button onClick={onClose}><X size={17}/></button></div></header><div className={`preview-content ${preview.kind}`}>{preview.kind === 'image' ? <img src={preview.content} alt={preview.name}/> : preview.kind === 'markdown' ? <ReactMarkdown>{preview.content}</ReactMarkdown> : <pre><code>{preview.content}</code></pre>}</div></section></div>
}
