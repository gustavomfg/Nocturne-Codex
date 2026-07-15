import type { RefObject } from 'react'
import { AlertTriangle, Brain, Check, ChevronRight, Code2, Folder, GitBranch, LoaderCircle, Menu, PanelRight, Settings, Terminal, X } from 'lucide-react'
import type { CodexStatus, GitInfo } from '../../types'
import { statusText } from '../../shared/format'

interface WorkspaceTopbarProps {
  title: string
  pathLabel: string
  gitInfo: GitInfo | null
  status: CodexStatus
  sidebarOpen: boolean
  inspectorOpen: boolean
  compact: boolean
  hasMemory: boolean
  sidebarTriggerRef: RefObject<HTMLButtonElement>
  inspectorTriggerRef: RefObject<HTMLButtonElement>
  onOpenSidebar(): void
  onSelectWorkspace(): void
  onOpenTool(tool: 'editor' | 'terminal'): void
  onReconnect(): void
  onMemory(): void
  onSettings(): void
  onToggleInspector(): void
}

export function WorkspaceTopbar({ title, pathLabel, gitInfo, status, sidebarOpen, inspectorOpen, compact, hasMemory, sidebarTriggerRef, inspectorTriggerRef, onOpenSidebar, onSelectWorkspace, onOpenTool, onReconnect, onMemory, onSettings, onToggleInspector }: WorkspaceTopbarProps) {
  const connectionSymbol = status === 'ready' || status === 'completed' ? 'ready' : status === 'failed' || status === 'disconnected' ? 'unavailable' : status === 'waiting-approval' ? 'attention' : 'busy'
  return <header className="topbar">
    {!sidebarOpen && <button ref={sidebarTriggerRef} className="icon-button" aria-label="Abrir barra lateral" title="Abrir barra lateral" aria-controls="workspace-sidebar" aria-expanded={sidebarOpen} onClick={onOpenSidebar}><Menu size={18}/></button>}
    <div className="title-block"><h1 title={title}>{title}</h1>{pathLabel && <button className="path-pill" title={pathLabel} onClick={onSelectWorkspace}><Folder size={13}/><span>{pathLabel.split(/[/\\]/).pop()}</span><ChevronRight size={12}/></button>}</div>
    <div className="top-actions">
      {gitInfo && <span className="branch-pill top-action-branch"><GitBranch size={12}/>{gitInfo.branch}</span>}
      {pathLabel && <><button className="icon-button top-action-workspace" aria-label="Abrir no WebStorm" title="Abrir no WebStorm" onClick={() => onOpenTool('editor')}><Code2 size={16}/></button><button className="icon-button top-action-workspace" aria-label="Abrir terminal" title="Abrir terminal" onClick={() => onOpenTool('terminal')}><Terminal size={16}/></button></>}
      <button className={`connection top-action-essential ${status}`} onClick={onReconnect} aria-label={`Codex: ${statusText(status)}. Reconectar`} title="Reconectar ao App Server"><span/><i className={`connection-symbol ${connectionSymbol}`} data-symbol={connectionSymbol} aria-hidden="true">{connectionSymbol === 'ready' ? <Check size={16}/> : connectionSymbol === 'attention' ? <AlertTriangle size={15}/> : connectionSymbol === 'busy' ? <LoaderCircle size={16}/> : <X size={16}/>}</i>{statusText(status)}</button>
      <button className={`icon-button top-action-essential ${hasMemory ? 'has-memory' : ''}`} aria-label="Memória do workspace" onClick={onMemory} title="Memória do workspace"><Brain size={17}/></button>
      <button className="icon-button top-action-secondary" aria-label="Abrir configurações" title="Abrir configurações" onClick={onSettings}><Settings size={17}/></button>
      {(!compact || !inspectorOpen) && <button ref={inspectorTriggerRef} className={`icon-button top-action-essential ${inspectorOpen ? 'selected' : ''}`} aria-label={inspectorOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} title={inspectorOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} aria-controls="agent-inspector" aria-expanded={inspectorOpen} onClick={onToggleInspector}><PanelRight size={18}/></button>}
    </div>
  </header>
}
