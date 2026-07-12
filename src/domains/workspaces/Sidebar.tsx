import { useEffect, useRef, type RefObject } from 'react'
import { ChevronRight, Code2, Folder, FolderOpen, History, Laptop, Menu, MessageSquarePlus, Search, Settings, Star, Trash2, X } from 'lucide-react'
import type { CodexSettings, Conversation, Workspace } from '../../types'
import { relativeTime } from '../../shared/format'

interface SidebarProps {
  open: boolean; conversations: Conversation[]; activeId: string | null; search: string; searchRef: RefObject<HTMLInputElement>; workspace: string; workspaces: Workspace[]; settings: CodexSettings; status: string;
  onClose(): void; onNew(): void; onSearch(value: string): void; onConversation(id: string): void; onDelete(id: string): void; onWorkspace(): void; onSavedWorkspace(path: string): void; onFavorite(item: Workspace): void; onSettings(): void
}

export function Sidebar({ open, conversations, activeId, search, searchRef, workspace, workspaces, settings, status, onClose, onNew, onSearch, onConversation, onDelete, onWorkspace, onSavedWorkspace, onFavorite, onSettings }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const newShortcut = navigator.platform.toLowerCase().includes('mac') ? '⌘ N' : 'Ctrl N'
  useEffect(() => { if (sidebarRef.current) sidebarRef.current.inert = !open }, [open])
  return <aside ref={sidebarRef} className={`sidebar ${open ? 'open' : 'collapsed'}`} aria-hidden={!open}>
    <div className="brand"><div className="brand-mark"><img src="/nocturne.svg" alt=""/></div><span>Nocturne <b>Codex</b></span><button className="icon-button sidebar-toggle" aria-label="Recolher barra lateral" title="Recolher barra lateral" onClick={onClose}><Menu size={17}/></button></div>
    <button className="new-chat" onClick={onNew}><MessageSquarePlus size={17}/><span>Nova conversa</span><kbd>{newShortcut}</kbd></button>
    <label className="search-box"><Search size={15}/><span className="sr-only">Buscar conversas</span><input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas"/>{search && <button type="button" aria-label="Limpar busca" title="Limpar busca" onClick={() => onSearch('')}><X size={13}/></button>}</label>
    <div className="section-label"><span>Recentes</span><History size={13}/></div>
    <nav className="conversation-list">
      {conversations.map((conversation) => <div key={conversation.id} className={`conversation-item ${conversation.id === activeId ? 'active' : ''}`}>
        <button className="conversation-open" onClick={() => onConversation(conversation.id)} aria-current={conversation.id === activeId ? 'page' : undefined}><span className="conversation-icon"><Code2 size={15}/></span><span className="conversation-copy"><strong>{conversation.title}</strong><small>{relativeTime(conversation.updatedAt)}</small></span></button>
        <button className="delete-button" aria-label={`Excluir conversa ${conversation.title}`} title="Excluir conversa" onClick={() => onDelete(conversation.id)}><Trash2 size={13}/></button>
      </div>)}
      {!conversations.length && <p className="empty-list">Nenhuma conversa ainda.</p>}
    </nav>
    <div className="sidebar-footer">
      {workspaces.slice(0, 4).map((item) => <div key={item.path} className={`workspace-mini ${workspace === item.path ? 'active' : ''}`}><button className="workspace-open" onClick={() => onSavedWorkspace(item.path)}><Folder size={13}/><span>{item.name}</span></button><button className="workspace-favorite" aria-label={item.favorite ? `Remover ${item.name} dos favoritos` : `Favoritar ${item.name}`} aria-pressed={item.favorite} title={item.favorite ? 'Remover dos favoritos' : 'Favoritar'} onClick={() => onFavorite(item)}><Star size={12} fill={item.favorite ? 'currentColor' : 'none'}/></button></div>)}
      <button className="workspace-card" onClick={onWorkspace}><span className="workspace-icon"><FolderOpen size={17}/></span><span><small>Workspace</small><strong>{workspace ? workspace.split(/[/\\]/).pop() : 'Selecionar projeto'}</strong></span><ChevronRight size={15}/></button>
      <div className="profile"><div className="avatar"><Laptop size={15}/></div><span><strong>Ambiente local</strong><small>{settings.codexVersion || 'Codex CLI'}</small></span><span className={`status-dot ${status}`} role="status" aria-label={`Codex: ${status}`}/><button className="settings-button" aria-label="Abrir configurações" title="Abrir configurações" onClick={onSettings}><Settings size={14}/></button></div>
    </div>
  </aside>
}
