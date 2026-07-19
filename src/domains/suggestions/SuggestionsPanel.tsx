import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, Check, Clipboard, Eye, FileCode2, GitCommit, ShieldAlert, X } from 'lucide-react'
import { suggestedCommit } from '../../../shared/suggestions'
import type { Suggestion, SuggestionStatus } from '../../types'
import { useDialogA11y } from '../../shared/useDialogA11y'
import { errorMessage } from '../../shared/format'
import { projectHealth, type ProjectHealth } from './projectHealth'
import './suggestions.css'

interface Props { suggestions: Suggestion[]; hasMore: boolean; loadingMore: boolean; onLoadMore(): void; onStatus(suggestion: Suggestion, status: SuggestionStatus): void; onApply(suggestion: Suggestion): void; onOpenFile(filePath: string): void; onNotify(value: string): void }
const labels: Record<string, string> = { architecture: 'Arquitetura', security: 'Segurança', performance: 'Performance', bug: 'Bug', cleanup: 'Limpeza', testing: 'Testes', documentation: 'Documentação', dependency: 'Dependência', accessibility: 'Acessibilidade' }
type HealthLabel = keyof ProjectHealth
type HealthChange = { from: number; to: number }

export function SuggestionsPanel({ suggestions, hasMore, loadingMore, onLoadMore, onStatus, onApply, onOpenFile, onNotify }: Props) {
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const health = useMemo(() => projectHealth(suggestions), [suggestions])
  const previousHealth = useRef<ProjectHealth | null>(null)
  const healthTimer = useRef<number | null>(null)
  const [healthChanges, setHealthChanges] = useState<Partial<Record<HealthLabel, HealthChange>>>({})
  const [healthAnnouncement, setHealthAnnouncement] = useState('')

  useEffect(() => {
    const previous = previousHealth.current
    previousHealth.current = health
    if (!previous) return
    const changes: Partial<Record<HealthLabel, HealthChange>> = {}
    for (const label of Object.keys(health) as HealthLabel[]) {
      if (previous[label].score !== health[label].score) changes[label] = { from: previous[label].score, to: health[label].score }
    }
    const changed = Object.entries(changes) as Array<[HealthLabel, HealthChange]>
    if (!changed.length) return
    setHealthChanges(changes)
    setHealthAnnouncement(`Saúde do projeto atualizada. ${changed.map(([label, value]) => `${label} passou de ${value.from} para ${value.to}`).join('. ')}.`)
    if (healthTimer.current !== null) window.clearTimeout(healthTimer.current)
    healthTimer.current = window.setTimeout(() => { setHealthChanges({}); setHealthAnnouncement(''); healthTimer.current = null }, 3_200)
  }, [health])
  useEffect(() => () => { if (healthTimer.current !== null) window.clearTimeout(healthTimer.current) }, [])

  if (!suggestions.length) return <div className="inspector-empty"><div><ShieldAlert size={22}/></div><p>Nenhuma sugestão publicada.</p><small>Use o modo Review para analisar o projeto sem alterar arquivos.</small></div>
  return <div className="suggestions-view">
    <section className={`health-card ${Object.keys(healthChanges).length ? 'is-updated' : ''}`}><div><strong>Saúde do projeto</strong><small>{Object.keys(healthChanges).length ? 'Indicadores recalculados agora' : 'Estimativa baseada nas sugestões abertas'}</small></div><p className="sr-only" role="status" aria-live="polite">{healthAnnouncement}</p><div className="health-grid">{Object.entries(health).map(([rawLabel, metric]) => { const label = rawLabel as HealthLabel; const change = healthChanges[label]; return <span className={`health-metric ${change ? change.to > change.from ? 'improved' : 'declined' : ''}`} key={label} title={metric.explanation}><b>{label}</b><div className="health-score">{change && <><s>{change.from}/10</s><ArrowRight size={12}/></>}<strong>{metric.score}/10</strong></div><small>{metric.explanation}</small></span> })}</div></section>
    <div className="suggestion-list">{suggestions.map((suggestion) => <article className={`suggestion-card ${suggestion.severity}`} key={suggestion.id}><header><span/><b>{labels[suggestion.category]}</b><small>{severityLabel(suggestion.severity)}</small></header><h4>{suggestion.title}</h4><p>{suggestion.description}</p><div className="suggestion-files">{suggestion.affectedFiles.slice(0, 4).map((file) => <button key={file} onClick={() => onOpenFile(file)}><FileCode2 size={12}/>{file}</button>)}</div><footer><em className={suggestion.status}>{statusLabel(suggestion.status)} · {new Date(suggestion.updatedAt).toLocaleDateString('pt-BR')}</em><button onClick={() => setSelected(suggestion)}><Eye size={13}/>Ver solução</button>{suggestion.status === 'pending' && <><button onClick={() => onStatus(suggestion, 'rejected')}><X size={13}/>Ignorar</button><button className="apply" onClick={() => onApply(suggestion)}><Check size={13}/>Aplicar</button></>}</footer></article>)}{hasMore && <button className="collection-load-more" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Carregando…' : 'Carregar sugestões anteriores'}</button>}</div>
    {selected && <SuggestionDialog suggestion={selected} onClose={() => setSelected(null)} onApply={() => { setSelected(null); onApply(selected) }} onOpenFile={onOpenFile} onNotify={onNotify}/>}
  </div>
}

function SuggestionDialog({ suggestion, onClose, onApply, onOpenFile, onNotify }: { suggestion: Suggestion; onClose(): void; onApply(): void; onOpenFile(file: string): void; onNotify(value: string): void }) {
  const commit = suggestedCommit(suggestion)
  const [copied, setCopied] = useState<'diff' | 'commit' | null>(null)
  const [copying, setCopying] = useState<'diff' | 'commit' | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const dialogRef = useDialogA11y<HTMLElement>(onClose)
  const copy = async (kind: 'diff' | 'commit', content: string) => {
    if (copying) return
    setCopying(kind)
    try { setCopyError(null); await window.nocturne.clipboard.writeText(content); setCopied(kind); onNotify(kind === 'diff' ? 'Solução copiada.' : 'Mensagem de commit copiada.'); window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1_600) }
    catch (error) { setCopyError(errorMessage(error)) }
    finally { setCopying(null) }
  }
  return createPortal(<div className="preview-backdrop" onMouseDown={onClose}><section ref={dialogRef} className="suggestion-dialog" role="dialog" aria-modal="true" aria-labelledby="suggestion-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><AlertTriangle size={17}/><span><strong id="suggestion-title">{suggestion.title}</strong><small>{labels[suggestion.category]} · nível {severityLabel(suggestion.severity)} · complexidade {severityLabel(suggestion.complexity)} · risco {severityLabel(suggestion.risk)}</small></span></div><button aria-label="Fechar sugestão" title="Fechar" onClick={onClose}><X size={17}/></button></header>
    <div className="suggestion-dialog-body"><h3>Problema e impacto</h3><p>{suggestion.description}</p><h3>Raciocínio</h3><p>{suggestion.reasoning}</p><h3>Benefícios esperados</h3>{suggestion.expectedBenefits.length ? <ul>{suggestion.expectedBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul> : <p>Não informado pela revisão.</p>}<h3>Arquivos afetados</h3><div className="dialog-files">{suggestion.affectedFiles.map((file) => <button key={file} onClick={() => onOpenFile(file)}><FileCode2 size={12}/>{file}</button>)}</div><div className="proposal-title"><h3>Solução proposta / diff</h3><button disabled={Boolean(copying)} onClick={() => void copy('diff', suggestion.proposedChanges)}><Clipboard size={12}/>{copying === 'diff' ? 'Copiando…' : copied === 'diff' ? 'Copiado' : 'Copiar diff'}</button></div><pre className="proposal-diff">{suggestion.proposedChanges.split('\n').map((line, index) => <span className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''} key={index}>{line}{'\n'}</span>)}</pre><div className="commit-suggestion"><GitCommit size={14}/><span><small>Commit sugerido</small><code>{commit}</code></span><button disabled={Boolean(copying)} aria-label={copying === 'commit' ? 'Copiando mensagem de commit' : copied === 'commit' ? 'Mensagem de commit copiada' : 'Copiar mensagem de commit'} title="Copiar mensagem de commit" onClick={() => void copy('commit', commit)}>{copied === 'commit' ? <Check size={12}/> : <Clipboard size={12}/>}</button></div></div>
    {copyError && <p className="suggestion-copy-error" role="alert">{copyError}</p>}<footer><button onClick={onClose}>Fechar</button>{suggestion.status === 'pending' && <button className="primary" onClick={onApply}>Preparar aplicação</button>}</footer>
  </section></div>, document.body)
}

function statusLabel(status: SuggestionStatus) { return ({ pending: 'Pendente', accepted: 'Aceita', rejected: 'Ignorada', applied: 'Aplicada' } as const)[status] }
function severityLabel(value: string) { return ({ info: 'informativo', low: 'baixo', medium: 'médio', high: 'alto', critical: 'crítico' } as Record<string, string>)[value] || value }
