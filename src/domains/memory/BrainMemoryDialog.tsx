import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Archive, Brain, Check, Pencil, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import type { BrainMemory, BrainMemoryKind, BrainMemoryScope, BrainMemoryStatus } from '../../../shared/brainMemory'
import { errorMessage, relativeTime } from '../../shared/format'
import { useDialogA11y } from '../../shared/useDialogA11y'

const kindLabels: Record<BrainMemoryKind, string> = { fact: 'Fato', decision: 'Decisão', preference: 'Preferência', constraint: 'Restrição', learning: 'Aprendizado' }
const statusLabels: Record<BrainMemoryStatus, string> = { candidate: 'Candidata', active: 'Ativa', outdated: 'Desatualizada', archived: 'Arquivada' }

export function BrainMemoryDialog({ conversationId, onClose, onNotify }: { conversationId: string; onClose(): void; onNotify(message: string): void }) {
  const [items, setItems] = useState<BrainMemory[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BrainMemoryStatus | 'all'>('all')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState<BrainMemoryKind>('fact')
  const [scope, setScope] = useState<BrainMemoryScope>('workspace')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'library' | 'create'>('library')
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)

  const load = useCallback(async (offset = 0, append = false) => {
    setLoading(true); setError(null)
    try {
      const page = await window.nocturne.brain.page(conversationId, offset, 50, search, filter === 'all' ? undefined : filter)
      setItems((current) => append ? [...current, ...page.items] : page.items); setHasMore(page.hasMore)
    } catch (loadError) { setError(errorMessage(loadError)) } finally { setLoading(false) }
  }, [conversationId, filter, search])

  useEffect(() => { void load() }, [load])

  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(query.trim()) }
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (saving || !content.trim()) return
    setSaving(true); setError(null)
    try {
      await window.nocturne.brain.create(conversationId, { kind, scope, content: content.trim() })
      setContent(''); await load(); onNotify('Candidata de memória criada para revisão.')
    } catch (createError) { setError(errorMessage(createError)) } finally { setSaving(false) }
  }
  const update = async (memory: BrainMemory, value: Parameters<typeof window.nocturne.brain.update>[2], message: string) => {
    if (saving) return; setSaving(true); setError(null)
    try { await window.nocturne.brain.update(conversationId, memory.id, value); setEditing(null); setConfirmDelete(null); await load(); onNotify(message) }
    catch (updateError) { setError(errorMessage(updateError)) } finally { setSaving(false) }
  }
  const remove = async (memory: BrainMemory) => {
    if (confirmDelete !== memory.id) { setConfirmDelete(memory.id); return }
    setSaving(true); setError(null)
    try { await window.nocturne.brain.delete(conversationId, memory.id); setConfirmDelete(null); await load(); onNotify('Memória excluída definitivamente.') }
    catch (deleteError) { setError(errorMessage(deleteError)) } finally { setSaving(false) }
  }

  const candidateCount = items.filter((memory) => memory.status === 'candidate').length
  return <div className="modal-backdrop" onMouseDown={onClose}><div ref={dialogRef} className="settings-dialog brain-dialog" role="dialog" aria-modal="true" aria-labelledby="brain-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <header className="modal-title brain-header"><span className="brain-mark" aria-hidden="true"><Brain size={20}/></span><span className="brain-title-copy"><strong id="brain-title">Segundo Cérebro</strong><small>Memórias locais, relevantes e sob seu controle</small></span><span className="brain-trust"><ShieldCheck size={15}/><span><strong>Aprovação humana</strong><small>Só memórias ativas chegam ao agente</small></span></span><button className="brain-close" aria-label="Fechar Segundo Cérebro" title="Fechar" onClick={onClose}><X size={17}/></button></header>
    <nav className="brain-mobile-tabs" role="tablist" aria-label="Seções do Segundo Cérebro"><button role="tab" aria-selected={mobileView === 'library'} onClick={() => setMobileView('library')}>Biblioteca</button><button role="tab" aria-selected={mobileView === 'create'} onClick={() => setMobileView('create')}>Criar memória</button></nav>
    <div className="brain-layout" data-mobile-view={mobileView}>
      <form className="brain-create" onSubmit={(event) => void create(event)} aria-labelledby="brain-create-title">
        <div className="brain-create-heading"><span><Sparkles size={16}/></span><div><strong id="brain-create-title">Capturar memória</strong><p>Registre algo que continuará útil em trabalhos futuros.</p></div></div>
        <div className="brain-review-note"><ShieldCheck size={14}/><span><strong>Revisão obrigatória</strong><small>Uma nova memória começa como candidata.</small></span></div>
        <div className="brain-create-options"><label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as BrainMemoryKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Escopo<select value={scope} onChange={(event) => setScope(event.target.value as BrainMemoryScope)}><option value="workspace">Workspace</option><option value="conversation">Conversa atual</option></select></label></div>
        <label className="brain-content-label">Conteúdo<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={8_000} aria-describedby="brain-content-help" placeholder="Ex.: decisões arquiteturais, preferências e restrições…"/><span id="brain-content-help"><small>{scope === 'workspace' ? 'Disponível nas conversas deste workspace.' : 'Usada somente nesta conversa.'}</small><small>{content.length.toLocaleString('pt-BR')} / 8.000</small></span></label>
        <button className="primary brain-create-action" disabled={saving || !content.trim()}><Plus size={15}/>{saving ? 'Salvando…' : 'Adicionar para revisão'}</button>
      </form>
      <section className="brain-library" aria-label="Biblioteca de memórias">
        <div className="brain-library-heading"><div><strong>Biblioteca</strong><small>{items.length ? `${items.length} memória(s) exibida(s)` : 'Seu conhecimento persistente'}</small></div>{candidateCount > 0 && <span className="brain-pending-count">{candidateCount} para revisar</span>}</div>
        <form className="brain-search" role="search" onSubmit={submitSearch}><label><Search size={15}/><input aria-label="Buscar memórias" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por decisão, tecnologia ou contexto…"/>{(query || search) && <button type="button" aria-label="Limpar busca" title="Limpar busca" onClick={() => { setQuery(''); setSearch('') }}><X size={14}/></button>}</label><button className="brain-search-action">Buscar</button><select aria-label="Filtrar estado" value={filter} onChange={(event) => setFilter(event.target.value as BrainMemoryStatus | 'all')}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></form>
        {error && <p className="brain-error" role="alert">{error}</p>}
        {loading && !items.length && <div className="brain-skeletons" role="status" aria-label="Carregando memórias"><span/><span/><span/></div>}
        {!loading && !items.length && <div className="brain-empty"><span><Brain size={25}/></span><strong>{search || filter !== 'all' ? 'Nenhuma correspondência' : 'Seu Segundo Cérebro está vazio'}</strong><small>{search || filter !== 'all' ? 'Ajuste a busca ou escolha outro estado.' : 'Crie uma candidata para começar a construir memória durável.'}</small><button onClick={() => setMobileView('create')}><Plus size={14}/>Criar primeira memória</button></div>}
        <div className={`brain-list ${loading ? 'is-refreshing' : ''}`}>{items.map((memory) => <article className={`brain-card ${memory.status}`} key={memory.id}>
          <div className="brain-card-top"><div className="brain-card-meta"><span>{kindLabels[memory.kind]}</span><span>{memory.scope === 'workspace' ? 'Workspace' : 'Conversa'}</span><span className="brain-source">{memory.sourceType === 'agent' ? 'Proposta pelo agente' : 'Criada por você'}</span></div><span className={`brain-status ${memory.status}`}>{statusLabels[memory.status]}</span></div>
          {editing === memory.id ? <div className="brain-edit"><label><span className="sr-only">Editar memória</span><textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={8_000}/></label><div><button disabled={saving} onClick={() => setEditing(null)}>Cancelar</button><button className="primary" disabled={saving || !editContent.trim()} onClick={() => void update(memory, { content: editContent.trim() }, 'Memória atualizada.')}>Salvar edição</button></div></div> : <p className="brain-card-content">{memory.content}</p>}
          <div className="brain-confidence" aria-label={`${memory.confidence}% de confiança`}><span><i style={{ width: `${memory.confidence}%` }}/></span><small>{memory.confidence}% confiança</small></div>
          <footer><small>Atualizada {relativeTime(memory.updatedAt)} · usada {memory.useCount} vez(es)</small><div className="brain-card-actions">
            {editing !== memory.id && <button disabled={saving} aria-label="Editar memória" title="Editar" onClick={() => { setEditing(memory.id); setEditContent(memory.content) }}><Pencil size={14}/></button>}
            {memory.status === 'candidate' && <button disabled={saving} className="success" onClick={() => void update(memory, { status: 'active' }, 'Memória aprovada e ativada.')}><Check size={14}/>Aprovar</button>}
            {memory.status === 'active' && <button disabled={saving} onClick={() => void update(memory, { status: 'outdated' }, 'Memória marcada como desatualizada.')}><RotateCcw size={14}/>Desatualizar</button>}
            {(memory.status === 'outdated' || memory.status === 'archived') && <button disabled={saving} onClick={() => void update(memory, { status: 'active' }, 'Memória reativada.')}><RotateCcw size={14}/>Reativar</button>}
            {memory.status !== 'archived' && <button disabled={saving} onClick={() => void update(memory, { status: 'archived' }, 'Memória arquivada.')}><Archive size={14}/>Arquivar</button>}
            {memory.status === 'archived' && <button disabled={saving} className="danger" onClick={() => void remove(memory)}><Trash2 size={14}/>{confirmDelete === memory.id ? 'Confirmar exclusão' : 'Excluir'}</button>}
          </div></footer>
        </article>)}</div>
        {loading && items.length > 0 && <p className="brain-loading" role="status">Atualizando biblioteca…</p>}
        {hasMore && !loading && <button className="brain-more" onClick={() => void load(items.length, true)}>Carregar memórias anteriores</button>}
      </section>
    </div>
  </div></div>
}
