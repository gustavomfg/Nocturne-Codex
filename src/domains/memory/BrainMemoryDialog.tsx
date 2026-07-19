import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Archive, Brain, Check, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
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
    try { await window.nocturne.brain.update(conversationId, memory.id, value); setEditing(null); await load(); onNotify(message) }
    catch (updateError) { setError(errorMessage(updateError)) } finally { setSaving(false) }
  }
  const remove = async (memory: BrainMemory) => {
    if (confirmDelete !== memory.id) { setConfirmDelete(memory.id); return }
    setSaving(true); setError(null)
    try { await window.nocturne.brain.delete(conversationId, memory.id); setConfirmDelete(null); await load(); onNotify('Memória excluída definitivamente.') }
    catch (deleteError) { setError(errorMessage(deleteError)) } finally { setSaving(false) }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div ref={dialogRef} className="settings-dialog brain-dialog" role="dialog" aria-modal="true" aria-labelledby="brain-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
    <header className="modal-title"><Brain size={18}/><span><strong id="brain-title">Segundo Cérebro</strong><small>Memórias locais, aprovadas e rastreáveis</small></span><button aria-label="Fechar Segundo Cérebro" title="Fechar" onClick={onClose}><X size={16}/></button></header>
    <div className="brain-layout">
      <form className="brain-create" onSubmit={(event) => void create(event)}>
        <strong>Nova candidata</strong><p>Ela só será usada pelo Codex depois da sua aprovação.</p>
        <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as BrainMemoryKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Escopo<select value={scope} onChange={(event) => setScope(event.target.value as BrainMemoryScope)}><option value="workspace">Workspace</option><option value="conversation">Conversa atual</option></select></label>
        <label>Conteúdo<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={8_000} placeholder="Uma decisão, preferência, restrição ou aprendizado útil…"/></label>
        <button className="primary" disabled={saving || !content.trim()}><Plus size={15}/>{saving ? 'Salvando…' : 'Adicionar candidata'}</button>
      </form>
      <section className="brain-library" aria-label="Biblioteca de memórias">
        <form className="brain-search" role="search" onSubmit={submitSearch}><label><span className="sr-only">Buscar memórias</span><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar memórias"/></label><button>Buscar</button><select aria-label="Filtrar estado" value={filter} onChange={(event) => setFilter(event.target.value as BrainMemoryStatus | 'all')}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></form>
        {error && <p className="brain-error" role="alert">{error}</p>}
        {!loading && !items.length && <div className="brain-empty"><Brain size={24}/><strong>Nenhuma memória encontrada</strong><small>Crie uma candidata ou ajuste a busca.</small></div>}
        <div className="brain-list">{items.map((memory) => <article className={`brain-card ${memory.status}`} key={memory.id}>
          <div className="brain-card-meta"><span>{kindLabels[memory.kind]}</span><span>{memory.scope === 'workspace' ? 'Workspace' : 'Conversa'}</span><span>{statusLabels[memory.status]}</span><span>{memory.confidence}% confiança</span></div>
          {editing === memory.id ? <div className="brain-edit"><label><span className="sr-only">Editar memória</span><textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={8_000}/></label><div><button disabled={saving} onClick={() => setEditing(null)}>Cancelar</button><button className="primary" disabled={saving || !editContent.trim()} onClick={() => void update(memory, { content: editContent.trim() }, 'Memória atualizada.')}>Salvar edição</button></div></div> : <p>{memory.content}</p>}
          <footer><small>Criada {relativeTime(memory.createdAt)} · usada {memory.useCount} vez(es)</small><div>
            {editing !== memory.id && <button aria-label="Editar memória" title="Editar" onClick={() => { setEditing(memory.id); setEditContent(memory.content) }}><Pencil size={14}/></button>}
            {memory.status === 'candidate' && <button className="success" onClick={() => void update(memory, { status: 'active' }, 'Memória aprovada e ativada.')}><Check size={14}/>Aprovar</button>}
            {memory.status === 'active' && <button onClick={() => void update(memory, { status: 'outdated' }, 'Memória marcada como desatualizada.')}><RotateCcw size={14}/>Desatualizar</button>}
            {(memory.status === 'outdated' || memory.status === 'archived') && <button onClick={() => void update(memory, { status: 'active' }, 'Memória reativada.')}><RotateCcw size={14}/>Reativar</button>}
            {memory.status !== 'archived' && <button onClick={() => void update(memory, { status: 'archived' }, 'Memória arquivada.')}><Archive size={14}/>Arquivar</button>}
            {memory.status === 'archived' && <button className="danger" onClick={() => void remove(memory)}><Trash2 size={14}/>{confirmDelete === memory.id ? 'Confirmar exclusão' : 'Excluir'}</button>}
          </div></footer>
        </article>)}</div>
        {loading && <p className="brain-loading" role="status">Carregando memórias…</p>}
        {hasMore && !loading && <button className="brain-more" onClick={() => void load(items.length, true)}>Carregar memórias anteriores</button>}
      </section>
    </div>
  </div></div>
}
