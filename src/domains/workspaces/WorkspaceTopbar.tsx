import type { RefObject } from 'react'
import { AlertTriangle, Brain, Check, ChevronRight, Code2, Folder, GitBranch, LoaderCircle, Menu, PanelRight, Settings, Terminal, X } from 'lucide-react'
import type { GitInfo } from '../../types'

interface WorkspaceTopbarProps {
  title: string
  pathLabel: string
  gitInfo: GitInfo | null
  status: string
  sidebarOpen: boolean
  inspectorOpen: boolean
  compact: boolean
  hasMemory: boolean
  sidebarTriggerRef: RefObject<HTMLButtonElement | null>
  inspectorTriggerRef: RefObject<HTMLButtonElement | null>
  onOpenSidebar(): void
  onSelectWorkspace(): void
  onOpenTool(tool: 'editor' | 'terminal'): void
  onMemory(): void
  onSettings(): void
  onToggleInspector(): void
}

const statusMeta = {
  disconnected: { label: 'Desconectado', symbol: 'unavailable' as const },
  starting: { label: 'Conectando', symbol: 'busy' as const },
  ready: { label: 'Pronto', symbol: 'ready' as const },
  planning: { label: 'Planejando', symbol: 'busy' as const },
  running: { label: 'Executando', symbol: 'busy' as const },
  'waiting-approval': { label: 'Aguardando aprovação', symbol: 'attention' as const },
  cancelling: { label: 'Cancelando', symbol: 'busy' as const },
  completed: { label: 'Concluído', symbol: 'ready' as const },
  failed: { label: 'Falha', symbol: 'unavailable' as const },
}

export function WorkspaceTopbar({ title, pathLabel, gitInfo, status, sidebarOpen, inspectorOpen, compact, hasMemory, sidebarTriggerRef, inspectorTriggerRef, onOpenSidebar, onSelectWorkspace, onOpenTool, onMemory, onSettings, onToggleInspector }: WorkspaceTopbarProps) {
  const meta = statusMeta[status as keyof typeof statusMeta] ?? { label: status, symbol: 'unavailable' as const }
  const SymbolIcon = meta.symbol === 'ready' ? Check : meta.symbol === 'attention' ? AlertTriangle : meta.symbol === 'busy' ? LoaderCircle : X
  return <header className="topbar">
    {!sidebarOpen && <button ref={sidebarTriggerRef} className="icon-button" aria-label="Abrir barra lateral" title="Abrir barra lateral" aria-controls="workspace-sidebar" aria-expanded={sidebarOpen} onClick={onOpenSidebar}><Menu size={18}/></button>}
    <div className="title-block"><h1 title={title}>{title}</h1>{pathLabel && <button className="path-pill" title={pathLabel} onClick={onSelectWorkspace}><Folder size={13}/><span>{pathLabel.split(/[/\\]/).pop()}</span><ChevronRight size={12}/></button>}</div>
    <div className="top-actions">
      {gitInfo && <span className="branch-pill top-action-branch"><GitBranch size={12}/>{gitInfo.branch}</span>}
      {pathLabel && <><button className="icon-button top-action-workspace" aria-label="Abrir no WebStorm" title="Abrir no WebStorm" onClick={() => onOpenTool('editor')}><Code2 size={16}/></button><button className="icon-button top-action-workspace" aria-label="Abrir terminal" title="Abrir terminal" onClick={() => onOpenTool('terminal')}><Terminal size={16}/></button></>}
      <span className={`connection top-action-essential ${status}`}><span/><i className={`connection-symbol ${meta.symbol}`} data-symbol={meta.symbol} aria-hidden="true"><SymbolIcon size={meta.symbol === 'ready' ? 16 : meta.symbol === 'attention' ? 15 : 16}/></i>{meta.label}</span>
      <button className={`icon-button top-action-essential ${hasMemory ? 'has-memory' : ''}`} aria-label="Memória do workspace" onClick={onMemory} title="Memória do workspace"><Brain size={17}/></button>
      <button className="icon-button top-action-secondary" aria-label="Abrir configurações" title="Abrir configurações" onClick={onSettings}><Settings size={17}/></button>
      {(!compact || !inspectorOpen) && <button ref={inspectorTriggerRef} className={`icon-button top-action-essential ${inspectorOpen ? 'selected' : ''}`} aria-label={inspectorOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} title={inspectorOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} aria-controls="agent-inspector" aria-expanded={inspectorOpen} onClick={onToggleInspector}><PanelRight size={18}/></button>}
    </div>
  </header>
}
