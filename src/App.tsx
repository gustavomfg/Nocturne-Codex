import { FormEvent, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Brain, ChevronRight, Code2, Folder, GitBranch, Menu, PanelRight, Settings, Terminal, X } from 'lucide-react'
import { useAppStore } from './store'
import type { Activity, AgentMode, Artifact, Attachment, ChangedFile, CodexEvent, CodexSettings, FilePreview, GitInfo, PlanStep, Suggestion, SuggestionStatus, Workspace, WorkspaceMemory } from './types'
import { Sidebar } from './domains/workspaces/Sidebar'
import { Composer } from './domains/chat/Composer'
import { AssistantMessage, MessageBubble, Welcome } from './domains/chat/ChatContent'
import { describeChanges, errorMessage, humanizeCommand, isBusy, normalizePlanStatus, parseChanges, statusText } from './shared/format'
import { UI_TIMING } from '../shared/constants'
import { useTurnLifecycle } from './domains/agent/useTurnLifecycle'
import { useConfirmDialog } from './shared/ConfirmDialog'
import './styles/components.css'

const now = () => new Date().toISOString()
const fakeId = () => crypto.randomUUID()
const AgentPanel = lazy(() => import('./domains/agent/AgentPanel').then((module) => ({ default: module.AgentPanel })))
const loadSettingsDialog = () => import('./domains/settings/SettingsDialog').then((module) => ({ default: module.SettingsDialog }))
const SettingsDialog = lazy(loadSettingsDialog)
const MemoryDialog = lazy(() => import('./domains/settings/Dialogs').then((module) => ({ default: module.MemoryDialog })))
const OnboardingDialog = lazy(() => import('./domains/settings/Dialogs').then((module) => ({ default: module.OnboardingDialog })))
const PreviewDialog = lazy(() => import('./domains/settings/Dialogs').then((module) => ({ default: module.PreviewDialog })))

function App() {
  const store = useAppStore()
  const confirmation = useConfirmDialog()
  const [workspace, setWorkspace] = useState('')
  const [prompt, setPrompt] = useState('')
  const [search, setSearch] = useState('')
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 980)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 980)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<CodexSettings>({ model: '', sandbox: 'workspace-write', approvalPolicy: 'on-request', theme: 'dark', defaultAgentMode: 'review' })
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [memory, setMemory] = useState<WorkspaceMemory>({ content: '', rules: '', updatedAt: '' })
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('nocturne.onboarding.completed') !== 'true')
  const [agentMode, setAgentMode] = useState<AgentMode>('review')
  const endRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const streamBufferRef = useRef('')
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activityBuffersRef = useRef(new Map<string, { type: Activity['type']; label: string; detail: string }>())
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTurnModeRef = useRef<AgentMode>('review')
  const applyingSuggestionRef = useRef<string | null>(null)
  const active = store.conversations.find((item) => item.id === store.activeId)
  const documentContent = store.streaming || [...store.messages].reverse().find((item) => item.role === 'assistant')?.content || ''
  const filtered = store.conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) && (!workspace || item.workspace === workspace))
  const finishTurn = useTurnLifecycle({ flushStream, activeTurnModeRef, applyingSuggestionRef, refreshGit })

  const refresh = async () => store.setConversations(await window.nocturne.conversations.list())

  useEffect(() => {
    void Promise.all([window.nocturne.conversations.list(), window.nocturne.workspace.list(), window.nocturne.settings.get()]).then(async ([conversations, savedWorkspaces, savedSettings]) => {
      const normalized = { ...savedSettings, model: savedSettings.model || '', sandbox: savedSettings.sandbox || 'workspace-write', approvalPolicy: savedSettings.approvalPolicy || 'on-request', theme: savedSettings.theme || 'dark', defaultAgentMode: savedSettings.defaultAgentMode || 'review' } as CodexSettings
      store.setConversations(conversations); store.setStatus(normalized.serverStatus || 'disconnected'); setWorkspaces(savedWorkspaces); setSettings(normalized); setAgentMode(normalized.defaultAgentMode || 'review')
      await window.nocturne.codex.start()
      if (conversations[0]) await openConversation(conversations[0].id, conversations)
    }).catch((error) => store.setError(error.message))
    const offStatus = window.nocturne.codex.onStatus(({ status, error }) => { store.setStatus(status); if (error) store.setError(error) })
    const offEvent = window.nocturne.codex.onEvent(handleCodexEvent)
    return () => { offStatus(); offEvent(); if (streamTimerRef.current) clearTimeout(streamTimerRef.current); if (activityTimerRef.current) clearTimeout(activityTimerRef.current) }
    // A ponte IPC deve ser registrada uma única vez; os handlers consultam o estado atual do Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const scroller = endRef.current?.closest('.chat-scroll')
    if (!scroller) return
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 220
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [store.messages, store.streaming])
  useEffect(() => { document.documentElement.dataset.theme = settings.theme || 'dark' }, [settings.theme])
  useEffect(() => {
    const preload = () => { void loadSettingsDialog() }
    const idle = window.requestIdleCallback?.(preload, { timeout: 1_500 })
    if (idle === undefined) { const timer = window.setTimeout(preload, 500); return () => window.clearTimeout(timer) }
    return () => window.cancelIdleCallback?.(idle)
  }, [])
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) { if (event.key === 'Escape' && isBusy(useAppStore.getState().status) && !document.querySelector('[aria-modal="true"]')) void cancelRun(); return }
      if (document.querySelector('[aria-modal="true"]')) return
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); void createConversation() }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); void selectWorkspace() }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus() }
      if (event.key === 'Enter') { event.preventDefault(); composerRef.current?.form?.requestSubmit() }
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  })
  useEffect(() => {
    if (!isBusy(store.status)) return
    const timer = setInterval(() => { const state = useAppStore.getState(); void window.nocturne.diagnostics.rendererStats({ responseSize: state.streaming.length, activities: state.activities.length, messages: state.messages.length }) }, UI_TIMING.diagnosticsIntervalMs)
    return () => clearInterval(timer)
  }, [store.status])

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
    if (isBusy(store.status) && id !== store.activeId) { store.setError('Cancele ou aguarde a execução atual antes de trocar de conversa.'); return }
    store.setActive(id); store.clearRun()
    const messages = await window.nocturne.conversations.messages(id)
    store.setMessages(messages)
    const lastMetadata = [...messages].reverse().find((message) => message.metadata)?.metadata
    if (lastMetadata) restoreMetadata(lastMetadata)
    const conversation = conversations.find((item) => item.id === id)
    if (conversation) setWorkspace(conversation.workspace)
    const [artifacts, savedMemory, suggestions] = await Promise.all([window.nocturne.artifacts.list(id), window.nocturne.memory.get(id), window.nocturne.suggestions.list(id)])
    store.setArtifacts(artifacts); store.setSuggestions(suggestions); setMemory(savedMemory); setPreview(null)
    try { await window.nocturne.codex.resume(id) } catch (error) { store.setError(`Não foi possível restaurar a thread: ${errorMessage(error)}`) }
    void refreshGit(id)
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    await submitPrompt(prompt)
  }

  async function submitPrompt(rawPrompt: string, mode: AgentMode = agentMode) {
    const content = rawPrompt.trim()
    if (!content || isBusy(store.status)) return
    let conversationId = store.activeId
    if (!conversationId) {
      await createConversation()
      conversationId = useAppStore.getState().activeId
    }
    if (!conversationId) return
    store.clearRun(); setPrompt('')
    const selectedAttachments = attachments
    activeTurnModeRef.current = mode
    setAttachments([])
    store.addMessage({ id: fakeId(), conversationId, role: 'user', content, metadata: JSON.stringify({ attachments: selectedAttachments.map((item) => item.path) }), createdAt: now() })
    try { const result = await window.nocturne.codex.send(conversationId, content, selectedAttachments.map((item) => item.path), mode); if (result.recreated) store.setError('A thread anterior não pôde ser restaurada. Uma nova thread foi criada para esta conversa.'); await refresh() }
    catch (error) { applyingSuggestionRef.current = null; store.setStatus('failed'); store.setError(error instanceof Error ? error.message : String(error)) }
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
    if (event.method === 'item/agentMessage/delta') queueStreamDelta(String(p.delta ?? ''))
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
      if (paths.length) store.upsertActivity({ id: 'fs-summary', type: 'file', label: `${paths.length} arquivo(s) observado(s)`, detail: paths.slice(-50).join('\n'), status: 'completed' })
    }
    if (event.method === 'item/commandExecution/requestApproval') store.addApproval({ key: String(p.approvalKey), kind: 'command', title: 'Executar comando', detail: String(p.command ?? p.reason ?? ''), status: 'pending' })
    if (event.method === 'item/fileChange/requestApproval') store.addApproval({ key: String(p.approvalKey), kind: 'file', title: 'Aplicar alterações', detail: 'O Codex solicitou permissão para modificar arquivos.', status: 'pending' })
    if (event.method === 'turn/completed') void finishTurn(p).catch((error) => { store.setStatus('failed'); store.setError(`Falha ao finalizar a resposta: ${errorMessage(error)}`) })
    if (event.method === 'error') {
      const message = String((p.error as Record<string, unknown>)?.message ?? p.message ?? 'Erro no Codex')
      store.setError(message); store.upsertActivity({ id: `error-${Date.now()}`, type: 'error', label: 'Erro na execução', detail: message, status: 'failed' })
    }
    if (event.method === 'warning') store.upsertActivity({ id: `warning-${Date.now()}`, type: 'error', label: 'Aviso do Codex', detail: String(p.message ?? p), status: 'failed' })
  }

  function queueStreamDelta(delta: string) {
    streamBufferRef.current += delta
    if (streamBufferRef.current.length > 100_000) streamBufferRef.current = streamBufferRef.current.slice(-100_000)
    if (streamTimerRef.current) return
    streamTimerRef.current = setTimeout(flushStream, UI_TIMING.streamFlushMs)
  }

  function flushStream() {
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current)
    streamTimerRef.current = null
    const buffered = streamBufferRef.current
    streamBufferRef.current = ''
    if (buffered) store.appendStream(buffered)
  }

  function addItemActivity(item?: Record<string, unknown>) {
    if (!item) return
    const type = String(item.type)
    if (type === 'commandExecution') store.upsertActivity({ id: String(item.id), type: 'command', label: humanizeCommand(String(item.command ?? '')), detail: String(item.command ?? ''), status: 'running' })
    if (type === 'fileChange') store.upsertActivity({ id: String(item.id), type: 'file', label: 'Preparando alterações em arquivos', status: 'running' })
    if (type === 'mcpToolCall' || type === 'dynamicToolCall') store.upsertActivity({ id: String(item.id), type: 'read', label: `Ferramenta: ${String(item.tool ?? type)}`, detail: JSON.stringify(item.arguments ?? ''), status: 'running' })
  }

  function appendActivityDetail(id: string, type: Activity['type'], label: string, delta: string) {
    const buffered = activityBuffersRef.current.get(id)
    activityBuffersRef.current.set(id, { type, label: buffered?.label || label, detail: `${buffered?.detail || ''}${delta}`.slice(-64_000) })
    if (!activityTimerRef.current) activityTimerRef.current = setTimeout(flushActivityDetails, UI_TIMING.activityFlushMs)
  }

  function flushActivityDetails() {
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current)
    activityTimerRef.current = null
    for (const [id, buffered] of activityBuffersRef.current) {
      const current = useAppStore.getState().activities.find((item) => item.id === id)
      store.upsertActivity({ id, type: buffered.type, label: current?.label || buffered.label, detail: `${current?.detail || ''}${buffered.detail}`.slice(-64_000), status: 'running' })
    }
    activityBuffersRef.current.clear()
  }

  function completeItem(item?: Record<string, unknown>) {
    if (!item) return
    flushActivityDetails()
    const type = String(item.type)
    if (type === 'commandExecution') store.upsertActivity({ id: String(item.id), type: 'command', label: humanizeCommand(String(item.command ?? '')), detail: [String(item.command ?? ''), String(item.aggregatedOutput ?? '')].filter(Boolean).join('\n\n'), status: item.status === 'failed' ? 'failed' : 'completed' })
    if (type === 'fileChange') {
      store.upsertActivity({ id: String(item.id), type: 'file', label: 'Arquivos atualizados', detail: describeChanges(item.changes), status: item.status === 'failed' ? 'failed' : 'completed' })
      store.addFiles(parseChanges(item.changes))
    }
    if (type === 'mcpToolCall' || type === 'dynamicToolCall') store.upsertActivity({ id: String(item.id), type: 'read', label: `Ferramenta concluída: ${String(item.tool ?? type)}`, detail: item.error ? JSON.stringify(item.error) : undefined, status: item.error ? 'failed' : 'completed' })
  }

  async function decide(key: string, accepted: boolean) {
    try { await window.nocturne.codex.approve(key, accepted); store.resolveApproval(key, accepted ? 'accepted' : 'declined') }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function updateSuggestion(suggestion: Suggestion, status: SuggestionStatus) {
    if (!store.activeId) return
    try { await window.nocturne.suggestions.status(store.activeId, suggestion.id, status); store.setSuggestions(await window.nocturne.suggestions.list(store.activeId)) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function applySuggestion(suggestion: Suggestion) {
    if (!store.activeId || isBusy(store.status)) return
    const steps: PlanStep[] = [
      { step: `Confirmar escopo em ${suggestion.affectedFiles.length || 1} arquivo(s)`, status: 'pending' },
      { step: 'Aplicar somente a proposta aprovada', status: 'pending' },
      { step: 'Executar typecheck, lint e testes relacionados quando disponíveis', status: 'pending' },
      { step: 'Relatar alterações e validações', status: 'pending' },
    ]
    const files = suggestion.affectedFiles.length ? suggestion.affectedFiles.join('\n• ') : 'arquivos a confirmar pelo agente'
    if (!await confirmation.confirm({ title: 'Aplicar esta sugestão?', description: `${suggestion.title}\n\nArquivos:\n• ${files}\n\nO agente poderá modificar somente o escopo confirmado e executará validações.`, confirmLabel: 'Preparar aplicação' })) return
    await updateSuggestion(suggestion, 'accepted')
    store.setPlan(steps, `Aplicação da sugestão: ${suggestion.title}`)
    applyingSuggestionRef.current = suggestion.id
    await submitPrompt(`Aplique a sugestão aprovada abaixo. Não amplie o escopo. Antes de editar, confirme os arquivos afetados; depois execute typecheck, lint e testes relacionados quando disponíveis.\n\nTítulo: ${suggestion.title}\nProblema: ${suggestion.description}\nJustificativa: ${suggestion.reasoning}\nArquivos: ${suggestion.affectedFiles.join(', ') || 'identificar antes de editar'}\nProposta:\n${suggestion.proposedChanges}`, 'build')
  }

  async function removeConversation(id: string) {
    const conversation = store.conversations.find((item) => item.id === id)
    if (!await confirmation.confirm({ title: 'Excluir conversa?', description: `“${conversation?.title || 'Esta conversa'}” e seu histórico local serão removidos. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir conversa', danger: true })) return
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
    try { const saved = await window.nocturne.settings.set(next); setSettings({ ...next, ...saved }); setAgentMode(next.defaultAgentMode || 'review'); setSettingsOpen(false) }
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
    if (!await confirmation.confirm({ title: 'Remover artefato?', description: 'O item será removido do painel. Arquivos existentes no workspace não serão apagados.', confirmLabel: 'Remover', danger: true })) return
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
    {sidebarOpen && <button className="panel-backdrop sidebar-backdrop" aria-label="Fechar barra lateral" onClick={() => setSidebarOpen(false)}/>}
    <Sidebar open={sidebarOpen} conversations={filtered} activeId={store.activeId} search={search} searchRef={searchRef} workspace={workspace} workspaces={workspaces} settings={settings} status={store.status} onClose={() => setSidebarOpen(false)} onNew={createConversation} onSearch={setSearch} onConversation={openConversation} onDelete={(id) => void removeConversation(id)} onWorkspace={selectWorkspace} onSavedWorkspace={chooseSavedWorkspace} onFavorite={(item) => void window.nocturne.workspace.favorite(item.path, !item.favorite).then(() => window.nocturne.workspace.list()).then(setWorkspaces)} onSettings={() => setSettingsOpen(true)}/>

    <main className="main-panel">
      <header className="topbar">
        {!sidebarOpen && <button className="icon-button" aria-label="Abrir barra lateral" title="Abrir barra lateral" onClick={() => setSidebarOpen(true)}><Menu size={18}/></button>}
        <div className="title-block"><h1>{title}</h1>{pathLabel && <button className="path-pill" onClick={selectWorkspace}><Folder size={13}/>{pathLabel.split(/[/\\]/).pop()}<ChevronRight size={12}/></button>}</div>
        <div className="top-actions">{gitInfo && <span className="branch-pill"><GitBranch size={12}/>{gitInfo.branch}</span>}{pathLabel && <><button className="icon-button" aria-label="Abrir no VS Code" title="Abrir no VS Code" onClick={() => window.nocturne.workspace.openTool(pathLabel, 'editor').catch((error) => store.setError(errorMessage(error)))}><Code2 size={16}/></button><button className="icon-button" aria-label="Abrir terminal" title="Abrir terminal" onClick={() => window.nocturne.workspace.openTool(pathLabel, 'terminal').catch((error) => store.setError(errorMessage(error)))}><Terminal size={16}/></button></>}<button className={`connection ${store.status}`} onClick={reconnect} title="Reconectar ao App Server"><span/>{statusText(store.status)}</button><button className={`icon-button ${memory.content ? 'has-memory' : ''}`} aria-label="Memória do workspace" onClick={() => store.activeId ? setMemoryOpen(true) : store.setError('Abra uma conversa para configurar a memória do workspace.')} title="Memória do workspace"><Brain size={17}/></button><button className="icon-button" aria-label="Abrir configurações" title="Abrir configurações" onClick={() => setSettingsOpen(true)}><Settings size={17}/></button><button className={`icon-button ${rightOpen ? 'selected' : ''}`} aria-label={rightOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} title={rightOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} onClick={() => setRightOpen(!rightOpen)}><PanelRight size={18}/></button></div>
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

      <Composer agentMode={agentMode} attachments={attachments} prompt={prompt} status={store.status} settings={settings} active={Boolean(store.activeId)} pendingApprovals={store.approvals.filter((item) => item.status === 'pending').length} composerRef={composerRef} onMode={setAgentMode} onPrompt={setPrompt} onRemoveAttachment={(path) => setAttachments((current) => current.filter((file) => file.path !== path))} onAttach={attachFiles} onCancel={cancelRun} onSubmit={send} onQuick={submitPrompt}/>
    </main>
    {rightOpen && <button className="panel-backdrop inspector-backdrop" aria-label="Fechar painel do agente" onClick={() => setRightOpen(false)}/>}

    <Suspense fallback={null}><AgentPanel open={rightOpen} activities={store.activities} approvals={store.approvals} diff={store.diff} files={store.files} artifacts={store.artifacts} suggestions={store.suggestions} plan={store.plan} planExplanation={store.planExplanation} activeId={store.activeId} gitInfo={gitInfo} documentContent={documentContent} onDecide={decide} onError={store.setError} onGitRefresh={refreshGit} onArtifactsRefresh={refreshArtifacts} onPreview={showFilePreview} onArtifact={showArtifact} onDeleteArtifact={deleteArtifact} onSuggestionStatus={updateSuggestion} onSuggestionApply={applySuggestion} onPlanChange={(plan) => store.setPlan(plan, store.planExplanation)} onPlanExecute={(plan) => submitPrompt(`Execute o plano aprovado abaixo. Siga os passos na ordem, atualize o progresso e teste as alterações.\n\n${plan.map((item, index) => `${index + 1}. ${item.step}`).join('\n')}`, 'build')}/></Suspense>
    <Suspense fallback={null}>{settingsOpen && <SettingsDialog
      value={settings}
      status={store.status}
      workspaces={workspaces}
      onClose={() => setSettingsOpen(false)}
      onSave={saveSettings}
      onOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true) }}
    />}</Suspense>
    {confirmation.dialog}<Suspense fallback={null}>
    {memoryOpen && <MemoryDialog value={memory} onClose={() => setMemoryOpen(false)} onSave={saveMemory}/>}
    {preview && <PreviewDialog preview={preview} activeId={store.activeId} onClose={() => setPreview(null)} onError={store.setError}/>}
    {onboardingOpen && <OnboardingDialog settings={settings} status={store.status} hasWorkspace={Boolean(workspace)} onWorkspace={selectWorkspace} onClose={() => { localStorage.setItem('nocturne.onboarding.completed', 'true'); setOnboardingOpen(false); composerRef.current?.focus() }}/>}
    </Suspense>
  </div>
}

export default App
