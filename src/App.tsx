import { FormEvent, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Activity as ActivityIcon, Check, ChevronRight, Code2, Command, FileCode2, Folder, FolderOpen, GitBranch, History, LoaderCircle, Menu, MessageSquarePlus, MoonStar, PanelRight, Plus, Search, Send, ShieldCheck, Sparkles, Square, Trash2, X } from 'lucide-react'
import { useAppStore } from './store'
import type { Activity, CodexEvent, Message } from './types'
import './App.css'

const now = () => new Date().toISOString()
const fakeId = () => crypto.randomUUID()

function App() {
  const store = useAppStore()
  const [workspace, setWorkspace] = useState('')
  const [prompt, setPrompt] = useState('')
  const [search, setSearch] = useState('')
  const [rightOpen, setRightOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const active = store.conversations.find((item) => item.id === store.activeId)
  const filtered = store.conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()))

  const refresh = async () => store.setConversations(await window.nocturne.conversations.list())

  useEffect(() => {
    void refresh().then(() => window.nocturne.codex.start()).catch((error) => store.setError(error.message))
    const offStatus = window.nocturne.codex.onStatus(({ status, error }) => { store.setStatus(status); if (error) store.setError(error) })
    const offEvent = window.nocturne.codex.onEvent(handleCodexEvent)
    return () => { offStatus(); offEvent() }
    // A ponte IPC deve ser registrada uma única vez; os handlers consultam o estado atual do Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages, store.streaming, store.activities])

  async function selectWorkspace() {
    const selected = await window.nocturne.workspace.select()
    if (selected) setWorkspace(selected)
  }

  async function createConversation() {
    let selected = workspace || active?.workspace
    if (!selected) selected = await window.nocturne.workspace.select() ?? ''
    if (!selected) return
    const conversation = await window.nocturne.conversations.create(selected)
    await refresh(); store.setActive(conversation.id); store.setMessages([]); store.clearRun(); setWorkspace(selected)
  }

  async function openConversation(id: string) {
    store.setActive(id); store.clearRun(); store.setMessages(await window.nocturne.conversations.messages(id))
    const conversation = store.conversations.find((item) => item.id === id)
    if (conversation) setWorkspace(conversation.workspace)
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = prompt.trim()
    if (!content || store.status === 'running') return
    let conversationId = store.activeId
    if (!conversationId) {
      await createConversation()
      conversationId = useAppStore.getState().activeId
    }
    if (!conversationId) return
    store.clearRun(); setPrompt('')
    store.addMessage({ id: fakeId(), conversationId, role: 'user', content, metadata: null, createdAt: now() })
    try { await window.nocturne.codex.send(conversationId, content); await refresh() }
    catch (error) { store.setStatus('error'); store.setError(error instanceof Error ? error.message : String(error)) }
  }

  function handleCodexEvent(event: CodexEvent) {
    const p = event.params
    if (event.method === 'item/agentMessage/delta') store.appendStream(String(p.delta ?? ''))
    if (event.method === 'item/reasoning/summaryTextDelta') store.upsertActivity({ id: String(p.itemId), type: 'reasoning', label: 'Analisando o projeto', detail: String(p.delta ?? ''), status: 'running' })
    if (event.method === 'turn/diff/updated') store.setDiff(String(p.diff ?? ''))
    if (event.method === 'item/started') addItemActivity(p.item as Record<string, unknown>)
    if (event.method === 'item/completed') completeItem(p.item as Record<string, unknown>)
    if (event.method === 'item/commandExecution/requestApproval') store.addApproval({ key: String(p.approvalKey), kind: 'command', title: 'Executar comando', detail: String(p.command ?? p.reason ?? ''), status: 'pending' })
    if (event.method === 'item/fileChange/requestApproval') store.addApproval({ key: String(p.approvalKey), kind: 'file', title: 'Aplicar alterações', detail: 'O Codex solicitou permissão para modificar arquivos.', status: 'pending' })
    if (event.method === 'turn/completed') void finishTurn(p)
    if (event.method === 'error') store.setError(String((p.error as Record<string, unknown>)?.message ?? p.message ?? 'Erro no Codex'))
  }

  function addItemActivity(item?: Record<string, unknown>) {
    if (!item) return
    const type = String(item.type)
    if (type === 'commandExecution') store.upsertActivity({ id: String(item.id), type: 'command', label: String(item.command ?? 'Executando comando'), status: 'running' })
    if (type === 'fileChange') store.upsertActivity({ id: String(item.id), type: 'file', label: 'Preparando alterações em arquivos', status: 'running' })
  }

  function completeItem(item?: Record<string, unknown>) {
    if (!item) return
    const type = String(item.type)
    if (type === 'commandExecution') store.upsertActivity({ id: String(item.id), type: 'command', label: String(item.command ?? 'Comando executado'), detail: String(item.aggregatedOutput ?? ''), status: item.status === 'failed' ? 'failed' : 'completed' })
    if (type === 'fileChange') store.upsertActivity({ id: String(item.id), type: 'file', label: 'Arquivos atualizados', detail: describeChanges(item.changes), status: item.status === 'failed' ? 'failed' : 'completed' })
  }

  async function finishTurn(params: Record<string, unknown>) {
    const state = useAppStore.getState()
    const turn = params.turn as Record<string, unknown> | undefined
    const error = turn?.error as Record<string, unknown> | undefined
    if (error) store.setError(String(error.message ?? 'A execução não foi concluída.'))
    if (state.streaming && state.activeId) {
      const saved = await window.nocturne.codex.saveAssistant(state.activeId, state.streaming, { diff: state.diff, activities: state.activities })
      store.addMessage(saved); store.appendStream(state.streaming ? '' : '')
      useAppStore.setState({ streaming: '' })
    }
  }

  async function decide(key: string, accepted: boolean) {
    await window.nocturne.codex.approve(key, accepted)
    store.resolveApproval(key, accepted ? 'accepted' : 'declined')
  }

  async function removeConversation(id: string) {
    await window.nocturne.conversations.delete(id)
    if (store.activeId === id) { store.setActive(null); store.setMessages([]) }
    await refresh()
  }

  const title = active?.title ?? 'Nova conversa'
  const pathLabel = active?.workspace ?? workspace

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
      <div className="brand"><div className="brand-mark"><MoonStar size={18}/></div><span>Nocturne <b>Codex</b></span><button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(false)}><Menu size={17}/></button></div>
      <button className="new-chat" onClick={createConversation}><MessageSquarePlus size={17}/><span>Nova conversa</span><kbd>⌘ N</kbd></button>
      <div className="search-box"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversas"/></div>
      <div className="section-label"><span>Recentes</span><History size={13}/></div>
      <nav className="conversation-list">
        {filtered.map((conversation) => <button key={conversation.id} className={`conversation-item ${conversation.id === store.activeId ? 'active' : ''}`} onClick={() => openConversation(conversation.id)}>
          <span className="conversation-icon"><Code2 size={15}/></span><span className="conversation-copy"><strong>{conversation.title}</strong><small>{relativeTime(conversation.updatedAt)}</small></span>
          <span className="delete-button" role="button" onClick={(event) => { event.stopPropagation(); void removeConversation(conversation.id) }}><Trash2 size={13}/></span>
        </button>)}
        {!filtered.length && <p className="empty-list">Nenhuma conversa ainda.</p>}
      </nav>
      <div className="sidebar-footer">
        <button className="workspace-card" onClick={selectWorkspace}><span className="workspace-icon"><FolderOpen size={17}/></span><span><small>Workspace</small><strong>{workspace ? workspace.split(/[/\\]/).pop() : 'Selecionar projeto'}</strong></span><ChevronRight size={15}/></button>
        <div className="profile"><div className="avatar">G</div><span><strong>Ambiente local</strong><small>Codex CLI</small></span><span className={`status-dot ${store.status}`}/></div>
      </div>
    </aside>

    <main className="main-panel">
      <header className="topbar">
        {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)}><Menu size={18}/></button>}
        <div className="title-block"><h1>{title}</h1>{pathLabel && <button className="path-pill" onClick={selectWorkspace}><Folder size={13}/>{pathLabel.split(/[/\\]/).pop()}<ChevronRight size={12}/></button>}</div>
        <div className="top-actions"><span className={`connection ${store.status}`}><span/>{statusText(store.status)}</span><button className={`icon-button ${rightOpen ? 'selected' : ''}`} onClick={() => setRightOpen(!rightOpen)}><PanelRight size={18}/></button></div>
      </header>

      <section className="chat-scroll">
        {!store.activeId && !store.messages.length ? <Welcome onNew={createConversation} onWorkspace={selectWorkspace}/> : <div className="chat-content">
          <div className="date-divider"><span>Hoje</span></div>
          {store.messages.map((message) => <MessageBubble key={message.id} message={message}/>) }
          {store.streaming && <AssistantMessage content={store.streaming} streaming/>}
          {store.error && <div className="error-card"><X size={16}/><span>{store.error}</span><button onClick={() => store.setError(null)}>Fechar</button></div>}
          <div ref={endRef}/>
        </div>}
      </section>

      <div className="composer-wrap"><form className="composer" onSubmit={send}>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} placeholder={store.activeId ? 'Peça ao Codex para criar, analisar ou modificar...' : 'Selecione um workspace e descreva o que deseja criar...'} rows={1}/>
        <div className="composer-bottom"><div className="composer-tools"><button type="button" onClick={selectWorkspace}><Plus size={17}/></button><span><ShieldCheck size={14}/> Workspace protegido</span></div><button className={`send-button ${store.status === 'running' ? 'stop' : ''}`} disabled={!prompt.trim() && store.status !== 'running'}>{store.status === 'running' ? <Square size={14} fill="currentColor"/> : <Send size={16}/>}</button></div>
      </form><small className="composer-hint">Enter para enviar · Shift + Enter para nova linha</small></div>
    </main>

    {rightOpen && <Inspector activities={store.activities} approvals={store.approvals} diff={store.diff} onDecide={decide}/>} 
  </div>
}

function Welcome({ onNew, onWorkspace }: { onNew(): void; onWorkspace(): void }) {
  return <div className="welcome"><div className="welcome-orb"><Sparkles size={30}/></div><h2>O que vamos construir?</h2><p>Converse com o Codex, explore seu projeto e transforme ideias em código — com você no controle.</p><div className="welcome-actions"><button onClick={onWorkspace}><FolderOpen size={17}/>Abrir projeto</button><button onClick={onNew}><MessageSquarePlus size={17}/>Nova conversa</button></div><div className="suggestions"><button onClick={onNew}><Code2/><span><strong>Analisar este projeto</strong><small>Entenda arquitetura e dependências</small></span></button><button onClick={onNew}><FileCode2/><span><strong>Criar documentação</strong><small>Gere um guia completo do projeto</small></span></button><button onClick={onNew}><GitBranch/><span><strong>Revisar alterações</strong><small>Encontre problemas antes do commit</small></span></button></div></div>
}

function MessageBubble({ message }: { message: Message }) {
  return message.role === 'user' ? <div className="user-row"><div className="user-message">{message.content}</div><div className="mini-avatar">G</div></div> : <AssistantMessage content={message.content}/>
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return <div className="assistant-row"><div className="assistant-avatar"><Sparkles size={15}/></div><div className="assistant-content"><div className="assistant-name">Nocturne Codex {streaming && <span>escrevendo</span>}</div><ReactMarkdown>{content}</ReactMarkdown>{streaming && <span className="caret"/>}</div></div>
}

function Inspector({ activities, approvals, diff, onDecide }: { activities: Activity[]; approvals: ReturnType<typeof useAppStore.getState>['approvals']; diff: string; onDecide(key: string, accepted: boolean): void }) {
  return <aside className="inspector"><div className="inspector-header"><div><ActivityIcon size={16}/><strong>Atividade</strong></div><span>{activities.filter((a) => a.status === 'running').length ? 'Em execução' : 'Em espera'}</span></div>
    <div className="inspector-scroll">
      {approvals.map((approval) => <div className={`approval-card ${approval.status}`} key={approval.key}><div className="approval-title"><span>{approval.kind === 'command' ? <Command size={15}/> : <FileCode2 size={15}/>}</span><strong>{approval.title}</strong></div><pre>{approval.detail}</pre>{approval.status === 'pending' ? <div className="approval-actions"><button onClick={() => onDecide(approval.key, false)}><X size={14}/>Recusar</button><button className="accept" onClick={() => onDecide(approval.key, true)}><Check size={14}/>Aprovar</button></div> : <small>{approval.status === 'accepted' ? 'Aprovado' : 'Recusado'}</small>}</div>)}
      <div className="timeline">{activities.map((item) => <div className="timeline-item" key={item.id}><span className={`timeline-dot ${item.status}`}>{item.status === 'running' ? <LoaderCircle size={13}/> : item.type === 'command' ? <Command size={12}/> : item.type === 'file' ? <FileCode2 size={12}/> : <Sparkles size={12}/>}</span><div><strong>{item.label}</strong>{item.detail && <pre>{item.detail.slice(0, 700)}</pre>}</div></div>)}</div>
      {diff && <div className="diff-panel"><div className="diff-title"><FileCode2 size={14}/>Alterações propostas</div><pre>{diff.split('\n').map((line, i) => <span key={i} className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''}>{line}{'\n'}</span>)}</pre></div>}
      {!activities.length && !approvals.length && !diff && <div className="inspector-empty"><div><ActivityIcon size={22}/></div><p>A atividade do agente aparecerá aqui.</p><small>Comandos, arquivos e aprovações em tempo real.</small></div>}
    </div>
  </aside>
}

function describeChanges(value: unknown) { if (!Array.isArray(value)) return ''; return value.map((item) => String((item as Record<string, unknown>).path ?? '')).filter(Boolean).join('\n') }
function relativeTime(date: string) { const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000); return mins < 1 ? 'agora' : mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.floor(mins / 60)} h` : `${Math.floor(mins / 1440)} d` }
function statusText(status: string) { return ({ offline: 'Codex offline', starting: 'Conectando', ready: 'Codex pronto', running: 'Executando', error: 'Erro de conexão' } as Record<string, string>)[status] }

export default App
