import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clipboard, Eye, FileCode2, GitCommit, ShieldAlert, X } from 'lucide-react'
import { suggestedCommit } from '../shared/suggestions'
import type { Suggestion, SuggestionStatus } from './types'
import './SuggestionsPanel.css'

interface Props { suggestions: Suggestion[]; onStatus(suggestion: Suggestion, status: SuggestionStatus): void; onApply(suggestion: Suggestion): void; onOpenFile(filePath: string): void }
const labels: Record<string, string> = { architecture: 'Arquitetura', security: 'Segurança', performance: 'Performance', bug: 'Bug', cleanup: 'Limpeza', testing: 'Testes', documentation: 'Documentação', dependency: 'Dependência', accessibility: 'Acessibilidade' }
const severityWeight: Record<string, number> = { info: 0, low: 0.5, medium: 1, high: 2, critical: 3 }

export function SuggestionsPanel({ suggestions, onStatus, onApply, onOpenFile }: Props) {
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const health = useMemo(() => projectHealth(suggestions), [suggestions])
  if (!suggestions.length) return <div className="inspector-empty"><div><ShieldAlert size={22}/></div><p>Nenhuma sugestão publicada.</p><small>Use Review Mode para analisar o projeto sem alterar arquivos.</small></div>
  return <div className="suggestions-view">
    <section className="health-card"><div><strong>Project Health</strong><small>Estimativa baseada apenas nas sugestões abertas</small></div><div className="health-grid">{Object.entries(health).map(([label, metric]) => <span key={label} title={metric.explanation}><b>{label}</b><strong>{metric.score}/10</strong><small>{metric.explanation}</small></span>)}</div></section>
    <div className="suggestion-list">{suggestions.map((suggestion) => <article className={`suggestion-card ${suggestion.severity}`} key={suggestion.id}><header><span/><b>{labels[suggestion.category]}</b><small>{suggestion.severity}</small></header><h4>{suggestion.title}</h4><p>{suggestion.description}</p><div className="suggestion-files">{suggestion.affectedFiles.slice(0, 4).map((file) => <button key={file} onClick={() => onOpenFile(file)}><FileCode2 size={10}/>{file}</button>)}</div><footer><em className={suggestion.status}>{statusLabel(suggestion.status)} · {new Date(suggestion.updatedAt).toLocaleDateString('pt-BR')}</em><button onClick={() => setSelected(suggestion)}><Eye size={12}/>Ver solução</button>{suggestion.status === 'pending' && <><button onClick={() => onStatus(suggestion, 'rejected')}><X size={12}/>Ignorar</button><button className="apply" onClick={() => onApply(suggestion)}><Check size={12}/>Aplicar</button></>}</footer></article>)}</div>
    {selected && <SuggestionDialog suggestion={selected} onClose={() => setSelected(null)} onApply={() => { setSelected(null); onApply(selected) }} onOpenFile={onOpenFile}/>} 
  </div>
}

function SuggestionDialog({ suggestion, onClose, onApply, onOpenFile }: { suggestion: Suggestion; onClose(): void; onApply(): void; onOpenFile(file: string): void }) {
  const commit = suggestedCommit(suggestion)
  return <div className="preview-backdrop" onMouseDown={onClose}><section className="suggestion-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><AlertTriangle size={17}/><span><strong>{suggestion.title}</strong><small>{labels[suggestion.category]} · nível {suggestion.severity} · complexidade {suggestion.complexity} · risco {suggestion.risk}</small></span></div><button onClick={onClose}><X size={17}/></button></header><div className="suggestion-dialog-body"><h3>Problema e impacto</h3><p>{suggestion.description}</p><h3>Raciocínio</h3><p>{suggestion.reasoning}</p><h3>Benefícios esperados</h3>{suggestion.expectedBenefits.length ? <ul>{suggestion.expectedBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul> : <p>Não informado pelo review.</p>}<h3>Arquivos afetados</h3><div className="dialog-files">{suggestion.affectedFiles.map((file) => <button key={file} onClick={() => onOpenFile(file)}><FileCode2 size={12}/>{file}</button>)}</div><div className="proposal-title"><h3>Solução proposta / diff</h3><button onClick={() => navigator.clipboard.writeText(suggestion.proposedChanges)}><Clipboard size={12}/>Copiar diff</button></div><pre className="proposal-diff">{suggestion.proposedChanges.split('\n').map((line, index) => <span className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''} key={index}>{line}{'\n'}</span>)}</pre><div className="commit-suggestion"><GitCommit size={14}/><span><small>Commit sugerido</small><code>{commit}</code></span><button onClick={() => navigator.clipboard.writeText(commit)}><Clipboard size={12}/></button></div></div><footer><button onClick={onClose}>Fechar</button>{suggestion.status === 'pending' && <button className="primary" onClick={onApply}>Preparar aplicação</button>}</footer></section></div>
}

function projectHealth(suggestions: Suggestion[]) {
  const pending = suggestions.filter((item) => item.status === 'pending' || item.status === 'accepted')
  const metric = (categories: string[]) => { const relevant = pending.filter((item) => categories.includes(item.category)); return { score: Math.max(1, Math.round(10 - relevant.reduce((sum, item) => sum + severityWeight[item.severity], 0))), explanation: relevant.length ? `${relevant.length} sugestão(ões) aberta(s); desconto proporcional à severidade.` : 'Nenhuma sugestão aberta nesta dimensão.' } }
  return { Arquitetura: metric(['architecture']), Segurança: metric(['security']), Testes: metric(['testing', 'bug']), Performance: metric(['performance']), Manutenção: metric(['cleanup', 'dependency', 'accessibility']), Documentação: metric(['documentation']) }
}
function statusLabel(status: SuggestionStatus) { return ({ pending: 'Pendente', accepted: 'Aceita', rejected: 'Ignorada', applied: 'Aplicada' } as const)[status] }
