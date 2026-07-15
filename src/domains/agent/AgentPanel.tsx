import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Activity as ActivityIcon, Check, Command, ExternalLink, Eye, FileCode2, FileDown, FolderOpen, GitBranch, ListChecks, LoaderCircle, PackageOpen, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import type { Activity, Approval, Artifact, GitInfo, PlanStep, Suggestion, SuggestionStatus } from '../../types'
import { useAppStore } from '../../store'
import { errorMessage, relativeTime } from '../../shared/format'
import { SuggestionsPanel } from '../suggestions/SuggestionsPanel'
import { GitPanel } from '../git/GitPanel'
import { useOffCanvasPanel } from '../../shared/useOffCanvasPanel'

interface AgentPanelProps {
  open: boolean; compact: boolean; triggerRef: RefObject<HTMLElement | null>; gitInfo: GitInfo | null;
  onClose(): void; onDecide(key: string, accepted: boolean): void; onError(value: string): void; onNotify(value: string): void; onGitRefresh(): void; onArtifactsRefresh(): void; onPreview(filePath: string): void; onArtifact(artifact: Artifact): void; onDeleteArtifact(id: string): void; onSuggestionStatus(suggestion: Suggestion, status: SuggestionStatus): void; onSuggestionApply(suggestion: Suggestion): void; onPlanChange(plan: PlanStep[]): void; onPlanExecute(plan: PlanStep[]): void
}

const tabs = ['activity', 'plan', 'suggestions', 'artifacts'] as const

export function AgentPanel({ open: isOpen, compact, triggerRef, gitInfo, onClose, onDecide, onError, onNotify, onGitRefresh, onArtifactsRefresh, onPreview, onArtifact, onDeleteArtifact, onSuggestionStatus, onSuggestionApply, onPlanChange, onPlanExecute }: AgentPanelProps) {
  const { activities, approvals, diff, files, artifacts, suggestions, plan, planExplanation, activeId, documentContent } = useAppStore(useShallow((state) => ({
    activities: state.activities, approvals: state.approvals, diff: state.diff, files: state.files, artifacts: state.artifacts, suggestions: state.suggestions,
    plan: state.plan, planExplanation: state.planExplanation, activeId: state.activeId,
    documentContent: [...state.messages].reverse().find((message) => message.role === 'assistant')?.content || '',
  })))
  const [tab, setTab] = useState<'activity' | 'plan' | 'suggestions' | 'artifacts'>('activity')
  const [exporting, setExporting] = useState<string | null>(null)
  const inspectorRef = useOffCanvasPanel<HTMLElement>({ open: isOpen, modal: compact, onClose, triggerRef })
  useEffect(() => { if (inspectorRef.current) inspectorRef.current.inert = !isOpen }, [inspectorRef, isOpen])
  const open = async (filePath: string, action: 'file' | 'folder' | 'editor') => { if (!activeId) return; try { await window.nocturne.files.open(activeId, filePath, action); onNotify(action === 'folder' ? 'Pasta do arquivo aberta.' : 'Arquivo aberto com sucesso.') } catch (error) { onError(errorMessage(error)) } }
  const exportDocument = async (format: 'md' | 'docx' | 'pdf' | 'html') => {
    if (!activeId || !documentContent || exporting) { if (!documentContent) onError('Não há uma resposta Markdown para exportar.'); return }
    setExporting(format)
    try { const result = format === 'md' ? await window.nocturne.documents.saveMarkdown(activeId, documentContent) : await window.nocturne.documents.export(activeId, documentContent, format); if (result) { onArtifactsRefresh(); onNotify(`Documento ${format.toUpperCase()} exportado.`) } }
    catch (error) { onError(errorMessage(error)) }
    finally { setExporting(null) }
  }
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setTab(tabs[next])
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending')
  const resolvedApprovals = approvals.filter((approval) => approval.status !== 'pending')
  const currentActivity = [...activities].reverse().find((activity) => activity.status === 'running') ?? activities[activities.length - 1]
  return <aside id="agent-inspector" ref={inspectorRef} className={`inspector ${isOpen ? 'open' : 'closed'}`} aria-hidden={!isOpen} role={compact && isOpen ? 'dialog' : undefined} aria-modal={compact && isOpen ? true : undefined} aria-label={compact && isOpen ? 'Painel do agente' : undefined} tabIndex={-1}><div className="inspector-header"><div><ActivityIcon size={16}/><strong>Agente</strong></div><span>{activities.some((activity) => activity.status === 'running') ? 'Em execução' : 'Em espera'}</span>{compact && <button className="inspector-close" aria-label="Fechar painel do agente" title="Fechar painel" onClick={onClose}><X size={16}/></button>}</div>
    <div className="inspector-tabs" role="tablist" aria-label="Painel do agente"><button id="agent-tab-activity" role="tab" aria-controls="agent-panel-activity" aria-selected={tab === 'activity'} tabIndex={tab === 'activity' ? 0 : -1} className={tab === 'activity' ? 'active' : ''} onKeyDown={(event) => moveTab(event, 0)} onClick={() => setTab('activity')}><ActivityIcon size={12}/>Atividade</button><button id="agent-tab-plan" role="tab" aria-controls="agent-panel-plan" aria-selected={tab === 'plan'} tabIndex={tab === 'plan' ? 0 : -1} className={tab === 'plan' ? 'active' : ''} onKeyDown={(event) => moveTab(event, 1)} onClick={() => setTab('plan')}><ListChecks size={12}/>Plano{plan.length > 0 && <span className="tab-count">{plan.length}</span>}</button><button id="agent-tab-suggestions" role="tab" aria-controls="agent-panel-suggestions" aria-selected={tab === 'suggestions'} tabIndex={tab === 'suggestions' ? 0 : -1} className={tab === 'suggestions' ? 'active' : ''} onKeyDown={(event) => moveTab(event, 2)} onClick={() => setTab('suggestions')}><ShieldCheck size={12}/>Sugestões{suggestions.length > 0 && <span className="tab-count">{suggestions.length}</span>}</button><button id="agent-tab-artifacts" role="tab" aria-controls="agent-panel-artifacts" aria-selected={tab === 'artifacts'} tabIndex={tab === 'artifacts' ? 0 : -1} className={tab === 'artifacts' ? 'active' : ''} onKeyDown={(event) => moveTab(event, 3)} onClick={() => setTab('artifacts')}><PackageOpen size={12}/>Artefatos{artifacts.length > 0 && <span className="tab-count">{artifacts.length}</span>}</button></div>
    <div className="inspector-scroll">
      {tab === 'activity' && <div id="agent-panel-activity" aria-labelledby="agent-tab-activity" className="tab-panel activity-panel" role="tabpanel">
        {(pendingApprovals.length > 0 || currentActivity) && <div className="activity-priority">{currentActivity && <div className={`current-operation ${currentActivity.status}`} role="status" aria-live="polite"><span>{currentActivity.status === 'running' ? <LoaderCircle size={15}/> : currentActivity.status === 'failed' ? <X size={15}/> : <Check size={15}/>}</span><div><small>Estado atual</small><strong>{currentActivity.label}</strong></div></div>}{pendingApprovals.length > 0 && <section aria-labelledby="pending-approvals-title"><h3 id="pending-approvals-title">Decisões pendentes <span>{pendingApprovals.length}</span></h3>{pendingApprovals.map((approval) => <ApprovalCard key={approval.key} approval={approval} onDecide={onDecide}/>)}</section>}</div>}
        <ActivityTimeline activities={activities}/>
        {!!files.length && <details className="activity-section" open><summary><FileCode2 size={14}/>Arquivos alterados <span>{files.length}</span></summary><div className="files-panel">{files.slice(-300).map((file) => <div className="changed-file" key={file.path}><span className={`file-kind ${file.kind}`}>{file.kind[0].toUpperCase()}</span><button aria-label={`Visualizar ${file.path}`} onClick={() => onPreview(file.path)}>{file.path.split(/[/\\]/).pop()}</button><button aria-label={`Visualizar ${file.path}`} title="Visualizar" onClick={() => onPreview(file.path)}><Eye size={12}/></button><button aria-label={`Abrir ${file.path} no editor`} title="Abrir no editor" onClick={() => void open(file.path, 'editor')}><ExternalLink size={12}/></button><button aria-label={`Mostrar ${file.path} na pasta`} title="Mostrar na pasta" onClick={() => void open(file.path, 'folder')}><FolderOpen size={12}/></button></div>)}</div></details>}
        {diff && <DiffSection diff={diff}/>}
        {gitInfo && <details className="activity-section"><summary><GitBranch size={14}/>Git e commit</summary><GitPanel activeId={activeId} gitInfo={gitInfo} onRefresh={onGitRefresh} onError={onError} onNotify={onNotify}/></details>}
        <details className="activity-section"><summary><FileDown size={14}/>Exportar resposta</summary><div className="document-panel"><div className="export-actions"><button disabled={Boolean(exporting)} aria-label="Exportar resposta em Markdown" onClick={() => void exportDocument('md')}>{exporting === 'md' ? '…' : 'MD'}</button><button disabled={Boolean(exporting)} aria-label="Exportar resposta em HTML" onClick={() => void exportDocument('html')}>{exporting === 'html' ? '…' : 'HTML'}</button><button disabled={Boolean(exporting)} aria-label="Exportar resposta em DOCX" onClick={() => void exportDocument('docx')}>{exporting === 'docx' ? '…' : 'DOCX'}</button><button disabled={Boolean(exporting)} aria-label="Exportar resposta em PDF" onClick={() => void exportDocument('pdf')}>{exporting === 'pdf' ? '…' : 'PDF'}</button></div></div></details>
        {!!resolvedApprovals.length && <details className="activity-section"><summary><ShieldCheck size={14}/>Histórico de decisões <span>{resolvedApprovals.length}</span></summary>{resolvedApprovals.map((approval) => <ApprovalCard key={approval.key} approval={approval} onDecide={onDecide}/>)}</details>}
        {!activities.length && !approvals.length && !diff && <div className="inspector-empty"><div><ActivityIcon size={22}/></div><p>A atividade do agente aparecerá aqui.</p><small>Comandos, arquivos e aprovações em tempo real.</small></div>}
      </div>}
      {tab === 'plan' && <div id="agent-panel-plan" aria-labelledby="agent-tab-plan" role="tabpanel"><PlanPanel plan={plan} explanation={planExplanation} onChange={onPlanChange} onExecute={onPlanExecute}/></div>}
      {tab === 'suggestions' && <div id="agent-panel-suggestions" aria-labelledby="agent-tab-suggestions" role="tabpanel"><SuggestionsPanel suggestions={suggestions} onStatus={onSuggestionStatus} onApply={onSuggestionApply} onOpenFile={onPreview} onNotify={onNotify}/></div>}
      {tab === 'artifacts' && <div id="agent-panel-artifacts" aria-labelledby="agent-tab-artifacts" role="tabpanel"><ArtifactsPanel artifacts={artifacts} onOpen={onArtifact} onDelete={onDeleteArtifact}/></div>}
    </div>
  </aside>
}

function ApprovalCard({ approval, onDecide }: { approval: Approval; onDecide(key: string, accepted: boolean): void }) {
  return <div className={`approval-card ${approval.status}`}><div className="approval-title"><span>{approval.kind === 'command' ? <Command size={15}/> : <FileCode2 size={15}/>}</span><strong>{approval.title}</strong></div><pre>{approval.detail}</pre>{approval.status === 'pending' ? <div className="approval-actions"><button onClick={() => onDecide(approval.key, false)}><X size={14}/>Recusar</button><button className="accept" onClick={() => onDecide(approval.key, true)}><Check size={14}/>Aprovar</button></div> : <small>{approval.status === 'accepted' ? 'Aprovado' : 'Recusado'}</small>}</div>
}

function PlanPanel({ plan, explanation, onChange, onExecute }: { plan: PlanStep[]; explanation: string; onChange(plan: PlanStep[]): void; onExecute(plan: PlanStep[]): void }) {
  const [editing, setEditing] = useState(false)
  const completed = plan.filter((item) => item.status === 'completed').length
  if (!plan.length) return <div className="inspector-empty"><div><ListChecks size={22}/></div><p>Nenhum plano publicado.</p><small>Quando o agente estruturar o trabalho, as etapas aparecerão aqui.</small></div>
  return <div className="plan-panel"><div className="plan-progress"><div><strong>Progresso do agente</strong><span>{completed}/{plan.length}</span></div><div className="progress-track"><span style={{ width: `${(completed / plan.length) * 100}%` }}/></div>{explanation && <p>{explanation}</p>}</div><div className="plan-list">{plan.map((item, index) => <div className={`plan-step ${item.status}`} key={`${index}-${item.step}`}><span>{item.status === 'completed' ? <Check size={12}/> : item.status === 'inProgress' ? <LoaderCircle size={12}/> : index + 1}</span><div>{editing ? <input value={item.step} onChange={(event) => onChange(plan.map((entry, entryIndex) => entryIndex === index ? { ...entry, step: event.target.value } : entry))}/> : <strong>{item.step}</strong>}<small>{item.status === 'completed' ? 'Concluído' : item.status === 'inProgress' ? 'Em andamento' : 'Pendente'}</small></div></div>)}</div><div className="plan-actions"><button onClick={() => setEditing(!editing)}>{editing ? 'Concluir edição' : 'Editar plano'}</button><button className="primary" onClick={() => onExecute(plan)} disabled={editing || !plan.every((item) => item.step.trim())}>Preparar execução</button></div></div>
}

function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const [details, setDetails] = useState(false)
  const visible = activities.slice(-120)
  return <><div className="activity-detail-toggle"><button onClick={() => setDetails(!details)}>{details ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}</button></div>{activities.length > visible.length && <small className="activity-limit-note">Mostrando as {visible.length} atividades mais recentes.</small>}<div className="timeline">{visible.map((item) => <div className="timeline-item" key={item.id}><span className={`timeline-dot ${item.status}`}>{item.status === 'running' ? <LoaderCircle size={13}/> : item.type === 'command' ? <Command size={12}/> : item.type === 'file' ? <FileCode2 size={12}/> : <Sparkles size={12}/>}</span><div><strong>{item.label}</strong>{details && item.detail && <pre>{item.detail.slice(0, 1400)}</pre>}</div></div>)}</div></>
}

function DiffSection({ diff }: { diff: string }) {
  const [open, setOpen] = useState(false)
  const limit = 300_000
  const truncated = diff.length > limit
  return <details className="activity-section" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary><FileCode2 size={14}/>Alterações propostas</summary>{open && <div className="diff-panel">{truncated && <small>Diff extenso: exibindo os {limit.toLocaleString('pt-BR')} caracteres mais recentes.</small>}<pre>{truncated ? diff.slice(-limit) : diff}</pre></div>}</details>
}

function ArtifactsPanel({ artifacts, onOpen, onDelete }: { artifacts: Artifact[]; onOpen(artifact: Artifact): void; onDelete(id: string): void }) {
  if (!artifacts.length) return <div className="inspector-empty"><div><PackageOpen size={22}/></div><p>Nenhum artefato ainda.</p><small>Respostas, diffs e arquivos produzidos pelo agente serão preservados aqui.</small></div>
  return <div className="artifact-list">{artifacts.map((artifact) => <div className="artifact-card" key={artifact.id}><button className="artifact-main" onClick={() => onOpen(artifact)}><span className={`artifact-icon ${artifact.type}`}>{artifact.type === 'file' ? <FileCode2 size={15}/> : artifact.type === 'diff' ? <GitBranch size={15}/> : <FileDown size={15}/>}</span><span><strong>{artifact.title}</strong><small>{artifact.type} · {relativeTime(artifact.updatedAt)}</small></span><Eye size={13}/></button><button className="artifact-delete" aria-label={`Remover artefato ${artifact.title}`} title="Remover do painel" onClick={() => onDelete(artifact.id)}><Trash2 size={12}/></button></div>)}</div>
}
