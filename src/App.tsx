import { FormEvent, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Activity as ActivityIcon, Brain, Check, ChevronRight, Code2, Command, Copy, ExternalLink, Eye, FileCode2, FileDown, Folder, FolderOpen, GitBranch, History, ListChecks, LoaderCircle, Menu, MessageSquarePlus, MoonStar, PackageOpen, Paperclip, PanelRight, Search, Send, Settings, ShieldCheck, Sparkles, Square, Star, Terminal, Trash2, X } from 'lucide-react'
import { useAppStore } from './store'
import type { Activity, Artifact, Attachment, ChangedFile, CodexEvent, CodexSettings, FilePreview, GitInfo, Message, PlanStep, Workspace, WorkspaceMemory } from './types'
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<CodexSettings>({ model: '', sandbox: 'workspace-write', approvalPolicy: 'on-request' })
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [memory, setMemory] = useState<WorkspaceMemory>({ content: '', rules: '', updatedAt: '' })
  const [memoryOpen, setMemoryOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const active = store.conversations.find((item) => item.id === store.activeId)
  const documentContent = store.streaming || [...store.messages].reverse().find((item) => item.role === 'assistant')?.content || ''
  const filtered = store.conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) && (!workspace || item.workspace === workspace))

  const refresh = async () => store.setConversations(await window.nocturne.conversations.list())

  useEffect(() => {
    void Promise.all([window.nocturne.conversations.list(), window.nocturne.workspace.list(), window.nocturne.settings.get()]).then(async ([conversations, savedWorkspaces, savedSettings]) => {
      store.setConversations(conversations); setWorkspaces(savedWorkspaces); setSettings({ ...savedSettings, model: savedSettings.model || '', sandbox: savedSettings.sandbox || 'workspace-write', approvalPolicy: savedSettings.approvalPolicy || 'on-request' })
      await window.nocturne.codex.start()
      if (conversations[0]) await openConversation(conversations[0].id, conversations)
    }).catch((error) => store.setError(error.message))
    const offStatus = window.nocturne.codex.onStatus(({ status, error }) => { store.setStatus(status); if (error) store.setError(error) })
    const offEvent = window.nocturne.codex.onEvent(handleCodexEvent)
    return () => { offStatus(); offEvent() }
    // A ponte IPC deve ser registrada uma única vez; os handlers consultam o estado atual do Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages, store.streaming, store.activities])

  async function selectWorkspace() {
    const selected = await window.nocturne.workspace.select()
    if (selected) { setWorkspace(selected); setWorkspaces(await window.nocturne.workspace.list()) }
  }

  async function createConversation() {
    let selected = workspace || active?.workspace
    if (!selected) selected = await window.nocturne.workspace.select() ?? ''
    if (!selected) return
    const conversation = await window.nocturne.conversations.create(selected)
    await refresh(); store.setActive(conversation.id); store.setMessages([]); store.clearRun(); setWorkspace(selected)
  }

  async function chooseSavedWorkspace(selected: string) {
    setWorkspace(selected)
    const conversation = store.conversations.find((item) => item.workspace === selected)
    if (conversation) await openConversation(conversation.id)
    else { store.setActive(null); store.setMessages([]); store.clearRun(); setGitInfo(null) }
  }

  async function openConversation(id: string, conversations = store.conversations) {
    if (store.status === 'running' && id !== store.activeId) { store.setError('Cancele ou aguarde a execução atual antes de trocar de conversa.'); return }
    store.setActive(id); store.clearRun()
    const messages = await window.nocturne.conversations.messages(id)
    store.setMessages(messages)
    const lastMetadata = [...messages].reverse().find((message) => message.metadata)?.metadata
    if (lastMetadata) restoreMetadata(lastMetadata)
    const conversation = conversations.find((item) => item.id === id)
    if (conversation) setWorkspace(conversation.workspace)
    const [artifacts, savedMemory] = await Promise.all([window.nocturne.artifacts.list(id), window.nocturne.memory.get(id)])
    store.setArtifacts(artifacts); setMemory(savedMemory); setPreview(null)
    try { await window.nocturne.codex.resume(id) } catch (error) { store.setError(`Não foi possível restaurar a thread: ${errorMessage(error)}`) }
    void refreshGit(id)
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    await submitPrompt(prompt)
  }

  async function submitPrompt(rawPrompt: string) {
    const content = rawPrompt.trim()
    if (!content || store.status === 'running') return
    let conversationId = store.activeId
    if (!conversationId) {
      await createConversation()
      conversationId = useAppStore.getState().activeId
    }
    if (!conversationId) return
    store.clearRun(); setPrompt('')
    const selectedAttachments = attachments
    setAttachments([])
    store.addMessage({ id: fakeId(), conversationId, role: 'user', content, metadata: JSON.stringify({ attachments: selectedAttachments.map((item) => item.path) }), createdAt: now() })
    try { const result = await window.nocturne.codex.send(conversationId, content, selectedAttachments.map((item) => item.path)); if (result.recreated) store.setError('A thread anterior não pôde ser restaurada. Uma nova thread foi criada para esta conversa.'); await refresh() }
    catch (error) { store.setStatus('error'); store.setError(error instanceof Error ? error.message : String(error)) }
  }

  async function attachFiles() {
    if (!store.activeId) { store.setError('Crie uma conversa antes de anexar arquivos.'); return }
    try { const selected = await window.nocturne.files.attach(store.activeId); setAttachments((current) => [...current, ...selected]) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function cancelRun() {
    if (!store.activeId) return
    try { await window.nocturne.codex.interrupt(store.activeId) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  function handleCodexEvent(event: CodexEvent) {
    const p = event.params
    if (event.method === 'item/agentMessage/delta') store.appendStream(String(p.delta ?? ''))
    if (event.method === 'item/reasoning/summaryTextDelta') appendActivityDetail(String(p.itemId), 'reasoning', 'Analisando o projeto', String(p.delta ?? ''))
    if (event.method === 'item/commandExecution/outputDelta') appendActivityDetail(String(p.itemId), 'command', 'Executando comando', String(p.delta ?? ''))
    if (event.method === 'item/fileChange/outputDelta') appendActivityDetail(String(p.itemId), 'file', 'Aplicando alterações', String(p.delta ?? ''))
    if (event.method === 'turn/diff/updated') store.setDiff(String(p.diff ?? ''))
    if (event.method === 'turn/plan/updated') {
      const plan = Array.isArray(p.plan) ? p.plan.map((entry) => { const item = entry as Record<string, unknown>; return { step: String(item.step ?? ''), status: normalizePlanStatus(item.status) } }) : []
      store.setPlan(plan, String(p.explanation ?? ''))
    }
    if (event.method === 'item/plan/delta' && !useAppStore.getState().plan.length) store.setPlan([{ step: String(p.delta ?? ''), status: 'inProgress' }])
    if (event.method === 'item/started') addItemActivity(p.item as Record<string, unknown>)
    if (event.method === 'item/completed') completeItem(p.item as Record<string, unknown>)
    if (event.method === 'fs/changed') {
      const paths = Array.isArray(p.changedPaths) ? p.changedPaths.map(String) : []
      paths.forEach((filePath) => store.upsertActivity({ id: `fs-${filePath}`, type: 'file', label: 'Filesystem atualizado', detail: filePath, status: 'completed' }))
    }
    if (event.method === 'item/commandExecution/requestApproval') store.addApproval({ key: String(p.approvalKey), kind: 'command', title: 'Executar comando', detail: String(p.command ?? p.reason ?? ''), status: 'pending' })
    if (event.method === 'item/fileChange/requestApproval') store.addApproval({ key: String(p.approvalKey), kind: 'file', title: 'Aplicar alterações', detail: 'O Codex solicitou permissão para modificar arquivos.', status: 'pending' })
    if (event.method === 'turn/completed') void finishTurn(p)
    if (event.method === 'error') {
      const message = String((p.error as Record<string, unknown>)?.message ?? p.message ?? 'Erro no Codex')
      store.setError(message); store.upsertActivity({ id: `error-${Date.now()}`, type: 'error', label: 'Erro na execução', detail: message, status: 'failed' })
    }
    if (event.method === 'warning') store.upsertActivity({ id: `warning-${Date.now()}`, type: 'error', label: 'Aviso do Codex', detail: String(p.message ?? p), status: 'failed' })
  }

  function addItemActivity(item?: Record<string, unknown>) {
    if (!item) return
    const type = String(item.type)
    if (type === 'commandExecution') store.upsertActivity({ id: String(item.id), type: 'command', label: humanizeCommand(String(item.command ?? '')), detail: String(item.command ?? ''), status: 'running' })
    if (type === 'fileChange') store.upsertActivity({ id: String(item.id), type: 'file', label: 'Preparando alterações em arquivos', status: 'running' })
    if (type === 'mcpToolCall' || type === 'dynamicToolCall') store.upsertActivity({ id: String(item.id), type: 'read', label: `Ferramenta: ${String(item.tool ?? type)}`, detail: JSON.stringify(item.arguments ?? ''), status: 'running' })
  }

  function appendActivityDetail(id: string, type: Activity['type'], label: string, delta: string) {
    const current = useAppStore.getState().activities.find((item) => item.id === id)
    store.upsertActivity({ id, type, label: current?.label || label, detail: `${current?.detail || ''}${delta}`, status: 'running' })
  }

  function completeItem(item?: Record<string, unknown>) {
    if (!item) return
    const type = String(item.type)
    if (type === 'commandExecution') store.upsertActivity({ id: String(item.id), type: 'command', label: humanizeCommand(String(item.command ?? '')), detail: [String(item.command ?? ''), String(item.aggregatedOutput ?? '')].filter(Boolean).join('\n\n'), status: item.status === 'failed' ? 'failed' : 'completed' })
    if (type === 'fileChange') {
      store.upsertActivity({ id: String(item.id), type: 'file', label: 'Arquivos atualizados', detail: describeChanges(item.changes), status: item.status === 'failed' ? 'failed' : 'completed' })
      store.addFiles(parseChanges(item.changes))
    }
    if (type === 'mcpToolCall' || type === 'dynamicToolCall') store.upsertActivity({ id: String(item.id), type: 'read', label: `Ferramenta concluída: ${String(item.tool ?? type)}`, detail: item.error ? JSON.stringify(item.error) : undefined, status: item.error ? 'failed' : 'completed' })
  }

  async function finishTurn(params: Record<string, unknown>) {
    const state = useAppStore.getState()
    const turn = params.turn as Record<string, unknown> | undefined
    const error = turn?.error as Record<string, unknown> | undefined
    if (error) store.setError(String(error.message ?? 'A execução não foi concluída.'))
    store.upsertActivity({ id: `completion-${String(turn?.id ?? Date.now())}`, type: 'completion', label: error ? 'Execução encerrada com erro' : 'Execução concluída', status: error ? 'failed' : 'completed' })
    if (state.streaming && state.activeId) {
      const current = useAppStore.getState()
      const saved = await window.nocturne.codex.saveAssistant(state.activeId, state.streaming, { diff: current.diff, activities: current.activities, files: current.files, plan: current.plan, planExplanation: current.planExplanation })
      store.addMessage(saved); store.appendStream(state.streaming ? '' : '')
      useAppStore.setState({ streaming: '' })
      store.setArtifacts(await window.nocturne.artifacts.list(state.activeId))
    }
    if (state.activeId) void refreshGit(state.activeId)
  }

  async function decide(key: string, accepted: boolean) {
    try { await window.nocturne.codex.approve(key, accepted); store.resolveApproval(key, accepted ? 'accepted' : 'declined') }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function removeConversation(id: string) {
    await window.nocturne.conversations.delete(id)
    if (store.activeId === id) { store.setActive(null); store.setMessages([]) }
    await refresh()
  }

  function restoreMetadata(metadata: string) {
    try {
      const parsed = JSON.parse(metadata) as { diff?: string; activities?: Activity[]; files?: ChangedFile[]; plan?: PlanStep[]; planExplanation?: string }
      if (parsed.diff) store.setDiff(parsed.diff)
      if (parsed.activities) parsed.activities.forEach(store.upsertActivity)
      if (parsed.files) store.setFiles(parsed.files)
      if (parsed.plan) store.setPlan(parsed.plan, parsed.planExplanation)
    } catch { /* metadata from older versions is optional */ }
  }

  async function refreshGit(conversationId = store.activeId) {
    if (!conversationId) return
    try { const info = await window.nocturne.git.status(conversationId); setGitInfo(info); if (info.diff && !useAppStore.getState().diff) store.setDiff(info.diff) }
    catch { setGitInfo(null) }
  }

  async function saveSettings(next: CodexSettings) {
    try { const saved = await window.nocturne.settings.set(next); setSettings({ ...next, ...saved }); setSettingsOpen(false) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function showFilePreview(filePath: string) {
    if (!store.activeId) return
    try { setPreview(await window.nocturne.files.preview(store.activeId, filePath)) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  function showArtifact(artifact: Artifact) {
    if (artifact.filePath) {
      if (/\.(pdf|docx)$/i.test(artifact.filePath)) { if (store.activeId) void window.nocturne.files.open(store.activeId, artifact.filePath, 'file').catch((error) => store.setError(errorMessage(error))); return }
      void showFilePreview(artifact.filePath); return
    }
    setPreview({ kind: artifact.type === 'response' || artifact.type === 'document' ? 'markdown' : 'text', name: artifact.title, filePath: '', mime: 'text/plain', content: artifact.content || '', size: artifact.content?.length || 0 })
  }

  async function deleteArtifact(artifactId: string) {
    if (!store.activeId) return
    try { await window.nocturne.artifacts.delete(store.activeId, artifactId); store.setArtifacts(await window.nocturne.artifacts.list(store.activeId)); if (preview) setPreview(null) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function refreshArtifacts() { if (store.activeId) store.setArtifacts(await window.nocturne.artifacts.list(store.activeId)) }

  async function saveMemory(content: string, rules: string) {
    if (!store.activeId) return
    try { setMemory(await window.nocturne.memory.set(store.activeId, content, rules)); setMemoryOpen(false) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function reconnect() {
    try { store.setError(null); await window.nocturne.codex.start(); if (store.activeId) await window.nocturne.codex.resume(store.activeId) }
    catch (error) { store.setError(errorMessage(error)) }
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
        {workspaces.slice(0, 4).map((item) => <div key={item.path} className={`workspace-mini ${workspace === item.path ? 'active' : ''}`}><button onClick={() => chooseSavedWorkspace(item.path)}><Folder size={13}/><span>{item.name}</span></button><button title={item.favorite ? 'Remover dos favoritos' : 'Favoritar'} onClick={async () => { await window.nocturne.workspace.favorite(item.path, !item.favorite); setWorkspaces(await window.nocturne.workspace.list()) }}><Star size={12} fill={item.favorite ? 'currentColor' : 'none'}/></button></div>)}
        <button className="workspace-card" onClick={selectWorkspace}><span className="workspace-icon"><FolderOpen size={17}/></span><span><small>Workspace</small><strong>{workspace ? workspace.split(/[/\\]/).pop() : 'Selecionar projeto'}</strong></span><ChevronRight size={15}/></button>
        <div className="profile"><div className="avatar">G</div><span><strong>Ambiente local</strong><small>{settings.codexVersion || 'Codex CLI'}</small></span><span className={`status-dot ${store.status}`}/><button className="settings-button" onClick={() => setSettingsOpen(true)}><Settings size={14}/></button></div>
      </div>
    </aside>

    <main className="main-panel">
      <header className="topbar">
        {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)}><Menu size={18}/></button>}
        <div className="title-block"><h1>{title}</h1>{pathLabel && <button className="path-pill" onClick={selectWorkspace}><Folder size={13}/>{pathLabel.split(/[/\\]/).pop()}<ChevronRight size={12}/></button>}</div>
        <div className="top-actions">{gitInfo && <span className="branch-pill"><GitBranch size={12}/>{gitInfo.branch}</span>}{pathLabel && <><button className="icon-button" title="Abrir no VS Code" onClick={() => window.nocturne.workspace.openTool(pathLabel, 'editor').catch((error) => store.setError(errorMessage(error)))}><Code2 size={16}/></button><button className="icon-button" title="Abrir terminal" onClick={() => window.nocturne.workspace.openTool(pathLabel, 'terminal').catch((error) => store.setError(errorMessage(error)))}><Terminal size={16}/></button></>}<button className={`connection ${store.status}`} onClick={reconnect} title="Reconectar ao App Server"><span/>{statusText(store.status)}</button><button className={`icon-button ${memory.content ? 'has-memory' : ''}`} onClick={() => store.activeId ? setMemoryOpen(true) : store.setError('Abra uma conversa para configurar a memória do workspace.')} title="Memória do workspace"><Brain size={17}/></button><button className="icon-button" onClick={() => setSettingsOpen(true)}><Settings size={17}/></button><button className={`icon-button ${rightOpen ? 'selected' : ''}`} onClick={() => setRightOpen(!rightOpen)}><PanelRight size={18}/></button></div>
      </header>

      <section className="chat-scroll">
        {!store.activeId && !store.messages.length ? <Welcome onNew={createConversation} onWorkspace={selectWorkspace} onPrompt={submitPrompt}/> : <div className="chat-content">
          <div className="date-divider"><span>Hoje</span></div>
          {store.messages.map((message) => <MessageBubble key={message.id} message={message}/>) }
          {store.streaming && <AssistantMessage content={store.streaming} streaming/>}
          {store.error && <div className="error-card"><X size={16}/><span>{store.error}</span><button onClick={() => store.setError(null)}>Fechar</button></div>}
          <div ref={endRef}/>
        </div>}
      </section>

      <div className="composer-wrap"><div className="quick-actions"><button onClick={() => submitPrompt('Analise este projeto e resuma arquitetura, dependências, riscos e próximos passos.')}><Code2 size={11}/>Analisar</button><button onClick={() => submitPrompt('Crie documentação completa em Markdown para este projeto e salve em DOCUMENTACAO.md.')}><FileCode2 size={11}/>Documentar</button><button onClick={() => submitPrompt('Revise as alterações Git atuais, buscando bugs, riscos e testes ausentes. Não modifique arquivos sem pedir.')}><GitBranch size={11}/>Revisar diff</button></div><form className="composer" onSubmit={send}>
        {!!attachments.length && <div className="attachment-list">{attachments.map((item) => <span key={item.path}><Paperclip size={11}/>{item.name}<button type="button" onClick={() => setAttachments((current) => current.filter((file) => file.path !== item.path))}><X size={11}/></button></span>)}</div>}
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} placeholder={store.activeId ? 'Peça ao Codex para criar, analisar ou modificar...' : 'Selecione um workspace e descreva o que deseja criar...'} rows={1}/>
        <div className="composer-bottom"><div className="composer-tools"><button type="button" title="Anexar arquivo" onClick={attachFiles}><Paperclip size={16}/></button><span><ShieldCheck size={14}/> {settings.sandbox}</span></div><button type={store.status === 'running' ? 'button' : 'submit'} onClick={store.status === 'running' ? cancelRun : undefined} className={`send-button ${store.status === 'running' ? 'stop' : ''}`} disabled={!prompt.trim() && store.status !== 'running'}>{store.status === 'running' ? <Square size={14} fill="currentColor"/> : <Send size={16}/>}</button></div>
      </form><small className="composer-hint">Enter para enviar · Shift + Enter para nova linha</small></div>
    </main>

    {rightOpen && <Inspector activities={store.activities} approvals={store.approvals} diff={store.diff} files={store.files} artifacts={store.artifacts} plan={store.plan} planExplanation={store.planExplanation} activeId={store.activeId} gitInfo={gitInfo} documentContent={documentContent} onDecide={decide} onError={store.setError} onGitRefresh={refreshGit} onArtifactsRefresh={refreshArtifacts} onPreview={showFilePreview} onArtifact={showArtifact} onDeleteArtifact={deleteArtifact} onPlanChange={(plan) => store.setPlan(plan, store.planExplanation)} onPlanExecute={(plan) => submitPrompt(`Execute o plano aprovado abaixo. Siga os passos na ordem, atualize o progresso e teste as alterações.\n\n${plan.map((item, index) => `${index + 1}. ${item.step}`).join('\n')}`)}/>} 
    {settingsOpen && <SettingsDialog value={settings} status={store.status} onClose={() => setSettingsOpen(false)} onSave={saveSettings}/>} 
    {memoryOpen && <MemoryDialog value={memory} workspace={workspace} onClose={() => setMemoryOpen(false)} onSave={saveMemory}/>} 
    {preview && <PreviewDialog preview={preview} activeId={store.activeId} onClose={() => setPreview(null)} onError={store.setError}/>} 
  </div>
}

function Welcome({ onNew, onWorkspace, onPrompt }: { onNew(): void; onWorkspace(): void; onPrompt(prompt: string): void }) {
  return <div className="welcome"><div className="welcome-orb"><Sparkles size={30}/></div><h2>O que vamos construir?</h2><p>Converse com o Codex, explore seu projeto e transforme ideias em código — com você no controle.</p><div className="welcome-actions"><button onClick={onWorkspace}><FolderOpen size={17}/>Abrir projeto</button><button onClick={onNew}><MessageSquarePlus size={17}/>Nova conversa</button></div><div className="suggestions"><button onClick={() => onPrompt('Analise este projeto. Explique a arquitetura, dependências, pontos de entrada, riscos e sugira próximos passos práticos.')}><Code2/><span><strong>Analisar este projeto</strong><small>Entenda arquitetura e dependências</small></span></button><button onClick={() => onPrompt('Crie uma documentação completa deste projeto em Markdown, incluindo instalação, arquitetura, uso, scripts e solução de problemas. Salve em DOCUMENTACAO.md.')}><FileCode2/><span><strong>Criar documentação</strong><small>Gere um guia completo do projeto</small></span></button><button onClick={() => onPrompt('Revise todas as alterações Git atuais. Aponte bugs, riscos, problemas de segurança e testes ausentes. Não modifique arquivos sem pedir.')}><GitBranch/><span><strong>Revisar alterações</strong><small>Encontre problemas antes do commit</small></span></button></div></div>
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role !== 'user') return <AssistantMessage content={message.content}/>
  let attachments: string[] = []
  try { attachments = (JSON.parse(message.metadata || '{}') as { attachments?: string[] }).attachments || [] } catch { /* optional metadata */ }
  return <div className="user-row"><div className="user-message">{message.content}{!!attachments.length && <div className="message-attachments">{attachments.map((filePath) => <span key={filePath}><Paperclip size={10}/>{filePath.split(/[/\\]/).pop()}</span>)}</div>}</div><div className="mini-avatar">G</div></div>
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return <div className="assistant-row"><div className="assistant-avatar"><Sparkles size={15}/></div><div className="assistant-content"><div className="assistant-name">Nocturne Codex {streaming && <span>escrevendo</span>}</div><ReactMarkdown>{content}</ReactMarkdown>{streaming && <span className="caret"/>}</div></div>
}

function Inspector({ activities, approvals, diff, files, artifacts, plan, planExplanation, activeId, gitInfo, documentContent, onDecide, onError, onGitRefresh, onArtifactsRefresh, onPreview, onArtifact, onDeleteArtifact, onPlanChange, onPlanExecute }: { activities: Activity[]; approvals: ReturnType<typeof useAppStore.getState>['approvals']; diff: string; files: ChangedFile[]; artifacts: Artifact[]; plan: PlanStep[]; planExplanation: string; activeId: string | null; gitInfo: GitInfo | null; documentContent: string; onDecide(key: string, accepted: boolean): void; onError(value: string): void; onGitRefresh(): void; onArtifactsRefresh(): void; onPreview(filePath: string): void; onArtifact(artifact: Artifact): void; onDeleteArtifact(id: string): void; onPlanChange(plan: PlanStep[]): void; onPlanExecute(plan: PlanStep[]): void }) {
  const [commitMessage, setCommitMessage] = useState('')
  const [tab, setTab] = useState<'activity' | 'plan' | 'artifacts'>('activity')
  const open = async (filePath: string, action: 'file' | 'folder' | 'editor') => { if (!activeId) return; try { await window.nocturne.files.open(activeId, filePath, action) } catch (error) { onError(errorMessage(error)) } }
  const exportDocument = async (format: 'md' | 'docx' | 'pdf' | 'html') => {
    if (!activeId || !documentContent) { onError('Não há uma resposta Markdown para exportar.'); return }
    try { if (format === 'md') await window.nocturne.documents.saveMarkdown(activeId, documentContent); else await window.nocturne.documents.export(activeId, documentContent, format); onArtifactsRefresh() }
    catch (error) { onError(errorMessage(error)) }
  }
  const commit = async () => { if (!activeId || !commitMessage.trim()) return; try { await window.nocturne.git.commit(activeId, commitMessage); setCommitMessage(''); onGitRefresh() } catch (error) { onError(errorMessage(error)) } }
  return <aside className="inspector"><div className="inspector-header"><div><ActivityIcon size={16}/><strong>Agente</strong></div><span>{activities.filter((a) => a.status === 'running').length ? 'Em execução' : 'Em espera'}</span></div>
    <div className="inspector-tabs"><button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}><ActivityIcon size={12}/>Atividade</button><button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}><ListChecks size={12}/>Plano{plan.length > 0 && <b>{plan.length}</b>}</button><button className={tab === 'artifacts' ? 'active' : ''} onClick={() => setTab('artifacts')}><PackageOpen size={12}/>Artefatos{artifacts.length > 0 && <b>{artifacts.length}</b>}</button></div>
    <div className="inspector-scroll">
      {tab === 'activity' && <>
      {approvals.map((approval) => <div className={`approval-card ${approval.status}`} key={approval.key}><div className="approval-title"><span>{approval.kind === 'command' ? <Command size={15}/> : <FileCode2 size={15}/>}</span><strong>{approval.title}</strong></div><pre>{approval.detail}</pre>{approval.status === 'pending' ? <div className="approval-actions"><button onClick={() => onDecide(approval.key, false)}><X size={14}/>Recusar</button><button className="accept" onClick={() => onDecide(approval.key, true)}><Check size={14}/>Aprovar</button></div> : <small>{approval.status === 'accepted' ? 'Aprovado' : 'Recusado'}</small>}</div>)}
      <ActivityTimeline activities={activities}/>
      {!!files.length && <div className="files-panel"><div className="diff-title"><FileCode2 size={14}/>Arquivos alterados <span>{files.length}</span></div>{files.map((file) => <div className="changed-file" key={file.path}><span className={`file-kind ${file.kind}`}>{file.kind[0].toUpperCase()}</span><button title="Visualizar" onClick={() => onPreview(file.path)}>{file.path.split(/[/\\]/).pop()}</button><button title="Visualizar" onClick={() => onPreview(file.path)}><Eye size={12}/></button><button title="Abrir no editor" onClick={() => open(file.path, 'editor')}><ExternalLink size={12}/></button><button title="Mostrar na pasta" onClick={() => open(file.path, 'folder')}><FolderOpen size={12}/></button></div>)}</div>}
      {diff && <div className="diff-panel"><div className="diff-title"><FileCode2 size={14}/>Alterações propostas</div><pre>{diff.split('\n').map((line, i) => <span key={i} className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''}>{line}{'\n'}</span>)}</pre></div>}
      {gitInfo && <div className="git-panel"><div className="diff-title"><GitBranch size={14}/>Git · {gitInfo.branch}</div><pre>{gitInfo.status || 'Workspace limpo'}</pre><div className="commit-row"><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Mensagem do commit"/><button disabled={!commitMessage.trim() || !gitInfo.status} onClick={commit}><Check size={13}/></button></div></div>}
      <div className="document-panel"><div className="diff-title"><FileDown size={14}/>Documento da resposta</div><div className="export-actions"><button onClick={() => exportDocument('md')}>MD</button><button onClick={() => exportDocument('html')}>HTML</button><button onClick={() => exportDocument('docx')}>DOCX</button><button onClick={() => exportDocument('pdf')}>PDF</button></div></div>
      {!activities.length && !approvals.length && !diff && <div className="inspector-empty"><div><ActivityIcon size={22}/></div><p>A atividade do agente aparecerá aqui.</p><small>Comandos, arquivos e aprovações em tempo real.</small></div>}
      </>}
      {tab === 'plan' && <PlanPanel plan={plan} explanation={planExplanation} onChange={onPlanChange} onExecute={onPlanExecute}/>} 
      {tab === 'artifacts' && <ArtifactsPanel artifacts={artifacts} onOpen={onArtifact} onDelete={onDeleteArtifact}/>} 
    </div>
  </aside>
}

function PlanPanel({ plan, explanation, onChange, onExecute }: { plan: PlanStep[]; explanation: string; onChange(plan: PlanStep[]): void; onExecute(plan: PlanStep[]): void }) {
  const [editing, setEditing] = useState(false)
  const completed = plan.filter((item) => item.status === 'completed').length
  if (!plan.length) return <div className="inspector-empty"><div><ListChecks size={22}/></div><p>Nenhum plano publicado.</p><small>Quando o agente estruturar o trabalho, as etapas aparecerão aqui.</small></div>
  return <div className="plan-panel"><div className="plan-progress"><div><strong>Progresso do agente</strong><span>{completed}/{plan.length}</span></div><div className="progress-track"><span style={{ width: `${(completed / plan.length) * 100}%` }}/></div>{explanation && <p>{explanation}</p>}</div><div className="plan-list">{plan.map((item, index) => <div className={`plan-step ${item.status}`} key={`${index}-${item.step}`}><span>{item.status === 'completed' ? <Check size={12}/> : item.status === 'inProgress' ? <LoaderCircle size={12}/> : index + 1}</span><div>{editing ? <input value={item.step} onChange={(event) => onChange(plan.map((entry, entryIndex) => entryIndex === index ? { ...entry, step: event.target.value } : entry))}/> : <strong>{item.step}</strong>}<small>{item.status === 'completed' ? 'Concluído' : item.status === 'inProgress' ? 'Em andamento' : 'Pendente'}</small></div></div>)}</div><div className="plan-actions"><button onClick={() => setEditing(!editing)}>{editing ? 'Concluir edição' : 'Editar plano'}</button><button className="primary" onClick={() => onExecute(plan)} disabled={editing || !plan.every((item) => item.step.trim())}>Aprovar e executar</button></div></div>
}

function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const [details, setDetails] = useState(false)
  return <><div className="activity-detail-toggle"><button onClick={() => setDetails(!details)}>{details ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}</button></div><div className="timeline">{activities.map((item) => <div className="timeline-item" key={item.id}><span className={`timeline-dot ${item.status}`}>{item.status === 'running' ? <LoaderCircle size={13}/> : item.type === 'command' ? <Command size={12}/> : item.type === 'file' ? <FileCode2 size={12}/> : <Sparkles size={12}/>}</span><div><strong>{item.label}</strong>{details && item.detail && <pre>{item.detail.slice(0, 1400)}</pre>}</div></div>)}</div></>
}

function ArtifactsPanel({ artifacts, onOpen, onDelete }: { artifacts: Artifact[]; onOpen(artifact: Artifact): void; onDelete(id: string): void }) {
  if (!artifacts.length) return <div className="inspector-empty"><div><PackageOpen size={22}/></div><p>Nenhum artefato ainda.</p><small>Respostas, diffs e arquivos produzidos pelo agente serão preservados aqui.</small></div>
  return <div className="artifact-list">{artifacts.map((artifact) => <div className="artifact-card" key={artifact.id}><button className="artifact-main" onClick={() => onOpen(artifact)}><span className={`artifact-icon ${artifact.type}`}>{artifact.type === 'file' ? <FileCode2 size={15}/> : artifact.type === 'diff' ? <GitBranch size={15}/> : <FileDown size={15}/>}</span><span><strong>{artifact.title}</strong><small>{artifact.type} · {relativeTime(artifact.updatedAt)}</small></span><Eye size={13}/></button><button className="artifact-delete" title="Remover do painel" onClick={() => onDelete(artifact.id)}><Trash2 size={12}/></button></div>)}</div>
}

function MemoryDialog({ value, workspace: _workspace, onClose, onSave }: { value: WorkspaceMemory; workspace: string; onClose(): void; onSave(content: string, rules: string): void }) {
  const [content, setContent] = useState(value.content)
  const [rules, setRules] = useState(value.rules)
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="settings-dialog memory-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><Brain size={17}/><strong>Contexto do workspace</strong><button onClick={onClose}><X size={16}/></button></div><p className="memory-description">Arquivos reais em <b>.nocturne/</b>, enviados ao Codex em cada novo turno.</p>{value.project && <div className="project-summary"><strong>{value.project.name}</strong><small>{value.project.primaryLanguage} · {value.project.stack.join(', ') || 'Stack não detectada'}</small></div>}<label>Memória e decisões<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000}/></label><label>Regras e padrões<textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={20_000}/></label><div className="memory-footer"><small>{(content.length + rules.length).toLocaleString()} caracteres · {value.updatedAt ? `Atualizada ${relativeTime(value.updatedAt)}` : 'Ainda não salva'}</small><div className="modal-actions"><button onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(content, rules)}>Salvar contexto</button></div></div></div></div>
}

function PreviewDialog({ preview, activeId, onClose, onError }: { preview: FilePreview; activeId: string | null; onClose(): void; onError(value: string): void }) {
  const open = async (action: 'editor' | 'folder') => { if (!activeId || !preview.filePath) return; try { await window.nocturne.files.open(activeId, preview.filePath, action) } catch (error) { onError(errorMessage(error)) } }
  const copy = async () => { try { await navigator.clipboard.writeText(preview.content); } catch (error) { onError(errorMessage(error)) } }
  return <div className="preview-backdrop" onMouseDown={onClose}><section className="preview-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><Eye size={16}/><span><strong>{preview.name}</strong><small>{formatBytes(preview.size)}{preview.filePath && ` · ${preview.filePath}`}</small></span></div><div>{preview.kind !== 'image' && <button onClick={copy} title="Copiar conteúdo"><Copy size={15}/></button>}{preview.filePath && <><button onClick={() => open('folder')} title="Abrir pasta"><FolderOpen size={15}/></button><button onClick={() => open('editor')} title="Abrir arquivo"><ExternalLink size={15}/></button></>}<button onClick={onClose}><X size={17}/></button></div></header><div className={`preview-content ${preview.kind}`}>{preview.kind === 'image' ? <img src={preview.content} alt={preview.name}/> : preview.kind === 'markdown' ? <ReactMarkdown>{preview.content}</ReactMarkdown> : <pre><code>{preview.content}</code></pre>}</div></section></div>
}

function SettingsDialog({ value, status, onClose, onSave }: { value: CodexSettings; status: string; onClose(): void; onSave(value: CodexSettings): void }) {
  const [form, setForm] = useState(value)
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="settings-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><Settings size={17}/><strong>Configurações do Codex</strong><button onClick={onClose}><X size={16}/></button></div><div className="codex-info"><span className={`status-dot ${status}`}/><div><strong>{statusText(status)}</strong><small>{value.codexVersion || 'Versão indisponível'} · {value.codexPath || 'codex'}<br/>Pandoc: {value.pandocVersion || 'indisponível'}</small></div></div><label>Modelo<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Padrão do Codex"/></label><label>Sandbox<select value={form.sandbox} onChange={(event) => setForm({ ...form, sandbox: event.target.value as CodexSettings['sandbox'] })}><option value="read-only">Somente leitura</option><option value="workspace-write">Escrita no workspace</option></select></label><label>Política de aprovação<select value={form.approvalPolicy} onChange={(event) => setForm({ ...form, approvalPolicy: event.target.value as CodexSettings['approvalPolicy'] })}><option value="untrusted">Comandos não confiáveis</option><option value="on-request">Quando solicitado</option><option value="never">Nunca solicitar</option></select></label><div className="modal-actions"><button onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(form)}>Salvar</button></div></div></div>
}

function describeChanges(value: unknown) { if (!Array.isArray(value)) return ''; return value.map((item) => String((item as Record<string, unknown>).path ?? '')).filter(Boolean).join('\n') }
function parseChanges(value: unknown): ChangedFile[] { if (!Array.isArray(value)) return []; return value.map((item) => { const change = item as Record<string, unknown>; const rawKind = String(change.kind ?? 'modified').toLowerCase(); return { path: String(change.path ?? ''), kind: (rawKind.includes('add') ? 'created' : rawKind.includes('delete') ? 'deleted' : 'modified') as ChangedFile['kind'], status: String(change.status ?? 'completed') } }).filter((item) => item.path) }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }
function humanizeCommand(command: string) {
  const value = command.replace(/^bash\s+-lc\s+['"]?/, '').replace(/['"]$/, '').trim()
  if (/\b(cat|sed|head|tail|less)\b/.test(value)) return `Lendo ${commandTarget(value)}`
  if (/\b(rg|grep|find)\b/.test(value)) return 'Procurando arquivos e referências'
  if (/\b(npm|pnpm|yarn|bun)\s+(test|run test)|\b(pytest|cargo test|go test)\b/.test(value)) return 'Executando testes'
  if (/\b(tsc|typecheck)\b/.test(value)) return 'Verificando tipos TypeScript'
  if (/\b(eslint|lint)\b/.test(value)) return 'Verificando qualidade do código'
  if (/\b(npm|pnpm|yarn|bun)\s+(install|i)\b/.test(value)) return 'Instalando dependências'
  if (/\bgit\s+(status|diff)\b/.test(value)) return 'Analisando alterações Git'
  if (/\bgit\s+commit\b/.test(value)) return 'Criando commit'
  if (/\b(mkdir|touch|cp|mv)\b/.test(value)) return 'Organizando arquivos do projeto'
  return 'Executando comando'
}
function commandTarget(command: string) { return command.match(/[\w./-]+\.[a-zA-Z0-9]+/)?.[0] ?? 'arquivo' }
function normalizePlanStatus(value: unknown): PlanStep['status'] { const status = String(value).toLowerCase(); return status.includes('complete') ? 'completed' : status.includes('progress') ? 'inProgress' : 'pending' }
function formatBytes(value: number) { return value < 1024 ? `${value} B` : value < 1_048_576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1_048_576).toFixed(1)} MB` }
function relativeTime(date: string) { const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000); return mins < 1 ? 'agora' : mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.floor(mins / 60)} h` : `${Math.floor(mins / 1440)} d` }
function statusText(status: string) { return ({ offline: 'Codex offline', starting: 'Conectando', ready: 'Codex pronto', running: 'Executando', error: 'Erro de conexão' } as Record<string, string>)[status] }

export default App
