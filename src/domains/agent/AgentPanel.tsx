import { useEffect, useRef, useState } from 'react'
import { Activity as ActivityIcon, Check, Command, ExternalLink, Eye, FileCode2, FileDown, FolderOpen, GitBranch, ListChecks, LoaderCircle, PackageOpen, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import type { Activity, Approval, Artifact, ChangedFile, GitInfo, PlanStep, Suggestion, SuggestionStatus } from '../../types'
import { errorMessage, relativeTime } from '../../shared/format'
import { SuggestionsPanel } from '../suggestions/SuggestionsPanel'
import { GitPanel } from '../git/GitPanel'

interface AgentPanelProps {
  open: boolean; activities: Activity[]; approvals: Approval[]; diff: string; files: ChangedFile[]; artifacts: Artifact[]; suggestions: Suggestion[]; plan: PlanStep[]; planExplanation: string; activeId: string | null; gitInfo: GitInfo | null; documentContent: string;
  onDecide(key: string, accepted: boolean): void; onError(value: string): void; onGitRefresh(): void; onArtifactsRefresh(): void; onPreview(filePath: string): void; onArtifact(artifact: Artifact): void; onDeleteArtifact(id: string): void; onSuggestionStatus(suggestion: Suggestion, status: SuggestionStatus): void; onSuggestionApply(suggestion: Suggestion): void; onPlanChange(plan: PlanStep[]): void; onPlanExecute(plan: PlanStep[]): void
}

export function AgentPanel({ open: isOpen, activities, approvals, diff, files, artifacts, suggestions, plan, planExplanation, activeId, gitInfo, documentContent, onDecide, onError, onGitRefresh, onArtifactsRefresh, onPreview, onArtifact, onDeleteArtifact, onSuggestionStatus, onSuggestionApply, onPlanChange, onPlanExecute }: AgentPanelProps) {
  const [tab, setTab] = useState<'activity' | 'plan' | 'suggestions' | 'artifacts'>('activity')
  const inspectorRef = useRef<HTMLElement>(null)
  useEffect(() => { if (inspectorRef.current) inspectorRef.current.inert = !isOpen }, [isOpen])
  const open = async (filePath: string, action: 'file' | 'folder' | 'editor') => { if (!activeId) return; try { await window.nocturne.files.open(activeId, filePath, action) } catch (error) { onError(errorMessage(error)) } }
  const exportDocument = async (format: 'md' | 'docx' | 'pdf' | 'html') => {
    if (!activeId || !documentContent) { onError('Não há uma resposta Markdown para exportar.'); return }
    try { if (format === 'md') await window.nocturne.documents.saveMarkdown(activeId, documentContent); else await window.nocturne.documents.export(activeId, documentContent, format); onArtifactsRefresh() }
    catch (error) { onError(errorMessage(error)) }
  }
  return <aside ref={inspectorRef} className={`inspector ${isOpen ? 'open' : 'closed'}`} aria-hidden={!isOpen}><div className="inspector-header"><div><ActivityIcon size={16}/><strong>Agente</strong></div><span>{activities.some((activity) => activity.status === 'running') ? 'Em execução' : 'Em espera'}</span></div>
    <div className="inspector-tabs" role="tablist" aria-label="Painel do agente"><button role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}><ActivityIcon size={12}/>Atividade</button><button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}><ListChecks size={12}/>Plano{plan.length > 0 && <b>{plan.length}</b>}</button><button role="tab" aria-selected={tab === 'suggestions'} className={tab === 'suggestions' ? 'active' : ''} onClick={() => setTab('suggestions')}><ShieldCheck size={12}/>Sugestões{suggestions.length > 0 && <b>{suggestions.length}</b>}</button><button role="tab" aria-selected={tab === 'artifacts'} className={tab === 'artifacts' ? 'active' : ''} onClick={() => setTab('artifacts')}><PackageOpen size={12}/>Artefatos{artifacts.length > 0 && <b>{artifacts.length}</b>}</button></div>
    <div className="inspector-scroll">
      {tab === 'activity' && <div className="tab-panel activity-panel" role="tabpanel">
        {approvals.map((approval) => <div className={`approval-card ${approval.status}`} key={approval.key}><div className="approval-title"><span>{approval.kind === 'command' ? <Command size={15}/> : <FileCode2 size={15}/>}</span><strong>{approval.title}</strong></div><pre>{approval.detail}</pre>{approval.status === 'pending' ? <div className="approval-actions"><button onClick={() => onDecide(approval.key, false)}><X size={14}/>Recusar</button><button className="accept" onClick={() => onDecide(approval.key, true)}><Check size={14}/>Aprovar</button></div> : <small>{approval.status === 'accepted' ? 'Aprovado' : 'Recusado'}</small>}</div>)}
        <ActivityTimeline activities={activities}/>
        {!!files.length && <div className="files-panel"><div className="diff-title"><FileCode2 size={14}/>Arquivos alterados <span>{files.length}</span></div>{files.map((file) => <div className="changed-file" key={file.path}><span className={`file-kind ${file.kind}`}>{file.kind[0].toUpperCase()}</span><button title="Visualizar" onClick={() => onPreview(file.path)}>{file.path.split(/[/\\]/).pop()}</button><button title="Visualizar" onClick={() => onPreview(file.path)}><Eye size={12}/></button><button title="Abrir no editor" onClick={() => open(file.path, 'editor')}><ExternalLink size={12}/></button><button title="Mostrar na pasta" onClick={() => open(file.path, 'folder')}><FolderOpen size={12}/></button></div>)}</div>}
        {diff && <div className="diff-panel"><div className="diff-title"><FileCode2 size={14}/>Alterações propostas</div><pre>{diff.split('\n').map((line, index) => <span key={index} className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''}>{line}{'\n'}</span>)}</pre></div>}
        {gitInfo && <GitPanel activeId={activeId} gitInfo={gitInfo} onRefresh={onGitRefresh} onError={onError}/>} 
        <div className="document-panel"><div className="diff-title"><FileDown size={14}/>Documento da resposta</div><div className="export-actions"><button onClick={() => exportDocument('md')}>MD</button><button onClick={() => exportDocument('html')}>HTML</button><button onClick={() => exportDocument('docx')}>DOCX</button><button onClick={() => exportDocument('pdf')}>PDF</button></div></div>
        {!activities.length && !approvals.length && !diff && <div className="inspector-empty"><div><ActivityIcon size={22}/></div><p>A atividade do agente aparecerá aqui.</p><small>Comandos, arquivos e aprovações em tempo real.</small></div>}
      </div>}
      {tab === 'plan' && <div role="tabpanel"><PlanPanel plan={plan} explanation={planExplanation} onChange={onPlanChange} onExecute={onPlanExecute}/></div>}
      {tab === 'suggestions' && <div role="tabpanel"><SuggestionsPanel suggestions={suggestions} onStatus={onSuggestionStatus} onApply={onSuggestionApply} onOpenFile={onPreview}/></div>}
      {tab === 'artifacts' && <div role="tabpanel"><ArtifactsPanel artifacts={artifacts} onOpen={onArtifact} onDelete={onDeleteArtifact}/></div>}
    </div>
  </aside>
}

function PlanPanel({ plan, explanation, onChange, onExecute }: { plan: PlanStep[]; explanation: string; onChange(plan: PlanStep[]): void; onExecute(plan: PlanStep[]): void }) {
  const [editing, setEditing] = useState(false)
  const completed = plan.filter((item) => item.status === 'completed').length
  if (!plan.length) return <div className="inspector-empty"><div><ListChecks size={22}/></div><p>Nenhum plano publicado.</p><small>Quando o agente estruturar o trabalho, as etapas aparecerão aqui.</small></div>
  return <div className="plan-panel"><div className="plan-progress"><div><strong>Progresso do agente</strong><span>{completed}/{plan.length}</span></div><div className="progress-track"><span style={{ width: `${(completed / plan.length) * 100}%` }}/></div>{explanation && <p>{explanation}</p>}</div><div className="plan-list">{plan.map((item, index) => <div className={`plan-step ${item.status}`} key={`${index}-${item.step}`}><span>{item.status === 'completed' ? <Check size={12}/> : item.status === 'inProgress' ? <LoaderCircle size={12}/> : index + 1}</span><div>{editing ? <input value={item.step} onChange={(event) => onChange(plan.map((entry, entryIndex) => entryIndex === index ? { ...entry, step: event.target.value } : entry))}/> : <strong>{item.step}</strong>}<small>{item.status === 'completed' ? 'Concluído' : item.status === 'inProgress' ? 'Em andamento' : 'Pendente'}</small></div></div>)}</div><div className="plan-actions"><button onClick={() => setEditing(!editing)}>{editing ? 'Concluir edição' : 'Editar plano'}</button><button className="primary" onClick={() => onExecute(plan)} disabled={editing || !plan.every((item) => item.step.trim())}>Aprovar e executar</button></div></div>
}

function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const [details, setDetails] = useState(false)
  return <><div className="activity-detail-toggle"><button onClick={() => setDetails(!details)}>{details ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}</button></div><div className="timeline">{activities.map((item) => <div className="timeline-item" key={item.id}><span className={`timeline-dot ${item.status}`}>{item.status === 'running' ? <LoaderCircle size={13}/> : item.type === 'command' ? <Command size={12}/> : item.type === 'file' ? <FileCode2 size={12}/> : <Sparkles size={12}/>}</span><div><strong>{item.label}</strong>{details && item.detail && <pre>{item.detail.slice(0, 1400)}</pre>}</div></div>)}</div></>
}

function ArtifactsPanel({ artifacts, onOpen, onDelete }: { artifacts: Artifact[]; onOpen(artifact: Artifact): void; onDelete(id: string): void }) {
  if (!artifacts.length) return <div className="inspector-empty"><div><PackageOpen size={22}/></div><p>Nenhum artefato ainda.</p><small>Respostas, diffs e arquivos produzidos pelo agente serão preservados aqui.</small></div>
  return <div className="artifact-list">{artifacts.map((artifact) => <div className="artifact-card" key={artifact.id}><button className="artifact-main" onClick={() => onOpen(artifact)}><span className={`artifact-icon ${artifact.type}`}>{artifact.type === 'file' ? <FileCode2 size={15}/> : artifact.type === 'diff' ? <GitBranch size={15}/> : <FileDown size={15}/>}</span><span><strong>{artifact.title}</strong><small>{artifact.type} · {relativeTime(artifact.updatedAt)}</small></span><Eye size={13}/></button><button className="artifact-delete" title="Remover do painel" onClick={() => onDelete(artifact.id)}><Trash2 size={12}/></button></div>)}</div>
}
