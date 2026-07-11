import { useEffect, useRef, type RefObject } from 'react'
import { ChevronRight, Code2, Folder, FolderOpen, History, Menu, MessageSquarePlus, Search, Settings, Star, Trash2 } from 'lucide-react'
import type { CodexSettings, Conversation, Workspace } from '../../types'
import { relativeTime } from '../../shared/format'

interface SidebarProps {
  open: boolean; conversations: Conversation[]; activeId: string | null; search: string; searchRef: RefObject<HTMLInputElement>; workspace: string; workspaces: Workspace[]; settings: CodexSettings; status: string;
  onClose(): void; onNew(): void; onSearch(value: string): void; onConversation(id: string): void; onDelete(id: string): void; onWorkspace(): void; onSavedWorkspace(path: string): void; onFavorite(item: Workspace): void; onSettings(): void
}

export function Sidebar({ open, conversations, activeId, search, searchRef, workspace, workspaces, settings, status, onClose, onNew, onSearch, onConversation, onDelete, onWorkspace, onSavedWorkspace, onFavorite, onSettings }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  useEffect(() => { if (sidebarRef.current) sidebarRef.current.inert = !open }, [open])
  return <aside ref={sidebarRef} className={`sidebar ${open ? 'open' : 'collapsed'}`} aria-hidden={!open}>
    <div className="brand"><div className="brand-mark"><img src="/nocturne.svg" alt=""/></div><span>Nocturne <b>Codex</b></span><button className="icon-button sidebar-toggle" aria-label="Recolher barra lateral" title="Recolher barra lateral" onClick={onClose}><Menu size={17}/></button></div>
    <button className="new-chat" onClick={onNew}><MessageSquarePlus size={17}/><span>Nova conversa</span><kbd>⌘ N</kbd></button>
    <div className="search-box"><Search size={15}/><input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar conversas"/></div>
    <div className="section-label"><span>Recentes</span><History size={13}/></div>
    <nav className="conversation-list">
      {conversations.map((conversation) => <button key={conversation.id} className={`conversation-item ${conversation.id === activeId ? 'active' : ''}`} onClick={() => onConversation(conversation.id)}>
        <span className="conversation-icon"><Code2 size={15}/></span><span className="conversation-copy"><strong>{conversation.title}</strong><small>{relativeTime(conversation.updatedAt)}</small></span>
        <span className="delete-button" role="button" tabIndex={0} aria-label={`Excluir conversa ${conversation.title}`} title="Excluir conversa" onClick={(event) => { event.stopPropagation(); onDelete(conversation.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onDelete(conversation.id) } }}><Trash2 size={13}/></span>
      </button>)}
      {!conversations.length && <p className="empty-list">Nenhuma conversa ainda.</p>}
    </nav>
    <div className="sidebar-footer">
      {workspaces.slice(0, 4).map((item) => <div key={item.path} className={`workspace-mini ${workspace === item.path ? 'active' : ''}`}><button onClick={() => onSavedWorkspace(item.path)}><Folder size={13}/><span>{item.name}</span></button><button title={item.favorite ? 'Remover dos favoritos' : 'Favoritar'} onClick={() => onFavorite(item)}><Star size={12} fill={item.favorite ? 'currentColor' : 'none'}/></button></div>)}
      <button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><FolderOpen size={17}/></span><span><small>Workspace</small><strong>{workspace ? workspace.split(/[/\\]/).pop() : 'Selecionar projeto'}</strong></span><ChevronRight size={15}/></button>
      <div className="profile"><div className="avatar">G</div><span><strong>Ambiente local</strong><small>{settings.codexVersion || 'Codex CLI'}</small></span><span className={`status-dot ${status}`}/><button className="settings-button" aria-label="Abrir configurações" title="Abrir configurações" onClick={onSettings}><Settings size={14}/></button></div>
    </div>
  </aside>
}
