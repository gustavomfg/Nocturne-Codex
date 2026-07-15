import { FormEvent, Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, Brain, Check, ChevronRight, Code2, Folder, GitBranch, LoaderCircle, Menu, PanelRight, Settings, Terminal, X } from 'lucide-react'
import { useAppStore } from './store'
import type { Activity, AgentMode, Artifact, Attachment, ChangedFile, CodexEvent, CodexSettings, FilePreview, GitInfo, PlanStep, Suggestion, SuggestionStatus, Workspace, WorkspaceMemory } from './types'
import { Sidebar } from './domains/workspaces/Sidebar'
import { Composer } from './domains/chat/Composer'
import { AssistantMessage, MessageBubble, Welcome } from './domains/chat/ChatContent'
import { errorMessage, isBusy, statusText } from './shared/format'
import { UI_TIMING } from '../shared/constants'
import { useTurnLifecycle, type ActiveTurnContext } from './domains/agent/useTurnLifecycle'
import { routeCodexEvent } from './domains/agent/routeCodexEvent'
import { useBufferedCodexEvents } from './domains/agent/useBufferedCodexEvents'
import { useConfirmDialog } from './shared/ConfirmDialog'
import './styles/components.css'
import './domains/settings/settings.css'
import './domains/agent/agent.css'
import './styles/product-constraints.css'

const now = () => new Date().toISOString()
const fakeId = () => crypto.randomUUID()
const dayKey = (value: string) => new Date(value).toLocaleDateString('pt-BR')
const dayLabel = (value: string) => {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(date)
}
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
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia('(max-width: 980px)').matches)
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
  const [newContent, setNewContent] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLElement>(null)
  const stickToBottomRef = useRef(true)
  const noticeTimerRef = useRef<number | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null)
  const inspectorTriggerRef = useRef<HTMLButtonElement>(null)
  const desktopPanelsRef = useRef({ sidebar: true, inspector: true })
  const { queueStreamDelta, flushStream, appendActivityDetail, addItemActivity, completeItem } = useBufferedCodexEvents()
  const activeTurnRef = useRef<ActiveTurnContext | null>(null)
  const applyingSuggestionRef = useRef<string | null>(null)
  const conversationRequestRef = useRef(0)
  const active = store.conversations.find((item) => item.id === store.activeId)
  const documentContent = store.streaming || [...store.messages].reverse().find((item) => item.role === 'assistant')?.content || ''
  const filtered = store.conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) && (!workspace || item.workspace === workspace))
  const finishTurn = useTurnLifecycle({ flushStream, activeTurnRef, refreshGit })
  const interactionLocked = () => { const state = useAppStore.getState(); return isBusy(state.status) || state.finalizing }

  function setSidebarVisibility(open: boolean) {
    if (compactLayout) { if (open) setRightOpen(false) }
    else desktopPanelsRef.current.sidebar = open
    setSidebarOpen(open)
  }

  function setInspectorVisibility(open: boolean) {
    if (compactLayout) { if (open) setSidebarOpen(false) }
    else desktopPanelsRef.current.inspector = open
    setRightOpen(open)
  }

  const refresh = async () => store.setConversations(await window.nocturne.conversations.list())

  useEffect(() => {
    void Promise.all([window.nocturne.conversations.list(), window.nocturne.workspace.list(), window.nocturne.settings.get()]).then(async ([conversations, savedWorkspaces, savedSettings]) => {
      const normalized = { ...savedSettings, model: savedSettings.model || '', sandbox: savedSettings.sandbox || 'workspace-write', approvalPolicy: savedSettings.approvalPolicy === 'untrusted' ? 'untrusted' : 'on-request', theme: 'dark', defaultAgentMode: savedSettings.defaultAgentMode || 'review' } as CodexSettings
      store.setConversations(conversations); store.setStatus(normalized.serverStatus || 'disconnected'); setWorkspaces(savedWorkspaces); setSettings(normalized); setAgentMode(normalized.defaultAgentMode || 'review')
      void window.nocturne.codex.start().then(async () => {
        const readiness = await window.nocturne.settings.check()
        setSettings((current) => ({ ...current, ...readiness })); store.setStatus(readiness.serverStatus || useAppStore.getState().status)
      }).catch((error) => store.setError(errorMessage(error)))
      if (conversations[0]) await openConversation(conversations[0].id, conversations, savedWorkspaces)
    }).catch((error) => store.setError(error.message))
    const offStatus = window.nocturne.codex.onStatus(({ status, error }) => { store.setStatus(status); if (status === 'completed' && activeTurnRef.current) store.setFinalizing(true); if (error) store.setError(error) })
    const offEvent = window.nocturne.codex.onEvent(handleCodexEvent)
    return () => { offStatus(); offEvent() }
    // A ponte IPC deve ser registrada uma única vez; os handlers consultam o estado atual do Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 980px)')
    const synchronizeLayout = (compact: boolean) => {
      setCompactLayout(compact)
      if (compact) setRightOpen(false)
      else {
        setSidebarOpen(desktopPanelsRef.current.sidebar)
        setRightOpen(desktopPanelsRef.current.inspector)
      }
    }
    synchronizeLayout(query.matches)
    const onChange = (event: MediaQueryListEvent) => synchronizeLayout(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    const scroller = chatScrollRef.current
    if (!scroller) return
    if (stickToBottomRef.current) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: store.streaming || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      setNewContent(false)
    } else if (store.streaming) setNewContent(true)
  }, [store.messages, store.streaming])
  useEffect(() => () => { if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current) }, [])
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
      if (interactionLocked()) return
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
    if (interactionLocked()) { store.setError('Aguarde a resposta ser concluída antes de trocar de workspace.'); return }
    const selected = await window.nocturne.workspace.select()
    if (selected) { setWorkspace(selected); setWorkspaces(await window.nocturne.workspace.list()) }
  }

  async function createConversation() {
    if (interactionLocked()) { store.setError('Aguarde a resposta ser concluída antes de criar outra conversa.'); return }
    let selected = workspace || active?.workspace
    if (!selected) selected = await window.nocturne.workspace.select() ?? ''
    if (!selected) return
    const conversation = await window.nocturne.conversations.create(selected)
    await refresh(); store.setActive(conversation.id); store.setMessages([]); store.clearRun(); setWorkspace(selected)
  }

  async function chooseSavedWorkspace(selected: string) {
    if (interactionLocked()) { store.setError('Aguarde a resposta ser concluída antes de trocar de workspace.'); return }
    setWorkspace(selected)
    const conversation = store.conversations.find((item) => item.workspace === selected)
    if (conversation) await openConversation(conversation.id)
    else { store.setActive(null); store.setMessages([]); store.clearRun(); setGitInfo(null) }
  }

  async function openConversation(id: string, conversations = store.conversations, availableWorkspaces = workspaces) {
    if (interactionLocked() && id !== useAppStore.getState().activeId) { store.setError('Cancele ou aguarde a execução atual antes de trocar de conversa.'); return }
    const requestId = ++conversationRequestRef.current
    stickToBottomRef.current = true; setNewContent(false)
    store.setActive(id); store.clearRun()
    const messages = await window.nocturne.conversations.messages(id)
    if (requestId !== conversationRequestRef.current || useAppStore.getState().activeId !== id) return
    store.setMessages(messages)
    const lastMetadata = [...messages].reverse().find((message) => message.metadata)?.metadata
    if (lastMetadata) restoreMetadata(lastMetadata)
    const conversation = conversations.find((item) => item.id === id)
    if (conversation) setWorkspace(conversation.workspace)
    const [artifacts, suggestions] = await Promise.all([window.nocturne.artifacts.list(id), window.nocturne.suggestions.list(id)])
    if (requestId !== conversationRequestRef.current || useAppStore.getState().activeId !== id) return
    store.setArtifacts(artifacts); store.setSuggestions(suggestions); setPreview(null)
    const workspaceEntry = conversation && availableWorkspaces.find((item) => item.path === conversation.workspace)
    if (conversation && !workspaceEntry?.authorized) {
      setMemory({ content: '', rules: '', updatedAt: '' }); setGitInfo(null)
      const accepted = await confirmation.confirm({ title: 'Reautorizar workspace?', description: `Esta conversa veio de um backup. Para proteger seus arquivos, confirme novamente a pasta antes de usar memória, Git ou Codex.\n\n${conversation.workspace}`, confirmLabel: 'Selecionar pasta' })
      if (requestId !== conversationRequestRef.current || useAppStore.getState().activeId !== id) return
      if (!accepted) { store.setError('Workspace não autorizado. A conversa permanece disponível somente para leitura do histórico.'); return }
      try {
        const selected = await window.nocturne.workspace.select(conversation.workspace)
        if (!selected) { store.setError('Reautorização cancelada. A conversa permanece disponível somente para leitura do histórico.'); return }
        const refreshedWorkspaces = await window.nocturne.workspace.list()
        setWorkspaces(refreshedWorkspaces); setWorkspace(selected)
      } catch (error) { store.setError(errorMessage(error)); return }
    }
    const savedMemory = await window.nocturne.memory.get(id)
    if (requestId !== conversationRequestRef.current || useAppStore.getState().activeId !== id) return
    setMemory(savedMemory)
    try { await window.nocturne.codex.resume(id) } catch (error) { store.setError(`Não foi possível restaurar a thread: ${errorMessage(error)}`) }
    void refreshGit(id)
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    await submitPrompt(prompt)
  }

  async function submitPrompt(rawPrompt: string, mode: AgentMode = agentMode) {
    const content = rawPrompt.trim()
    if (!content || interactionLocked()) return
    let conversationId = store.activeId
    if (!conversationId) {
      await createConversation()
      conversationId = useAppStore.getState().activeId
    }
    if (!conversationId) return
    store.clearRun(); setPrompt('')
    const selectedAttachments = attachments
    activeTurnRef.current = { conversationId, mode, suggestionId: applyingSuggestionRef.current }
    applyingSuggestionRef.current = null
    setAttachments([])
    store.addMessage({ id: fakeId(), conversationId, role: 'user', content, metadata: JSON.stringify({ attachments: selectedAttachments.map((item) => item.path) }), createdAt: now() })
    try { const result = await window.nocturne.codex.send(conversationId, content, selectedAttachments.map((item) => item.path), mode); if (result.recreated) store.setError('A thread anterior não pôde ser restaurada. Uma nova thread foi criada para esta conversa.'); await refresh() }
    catch (error) { activeTurnRef.current = null; applyingSuggestionRef.current = null; store.setFinalizing(false); store.setStatus('failed'); store.setError(error instanceof Error ? error.message : String(error)) }
  }

  function preparePrompt(value: string, mode: AgentMode = agentMode) {
    if (interactionLocked()) { store.setError('Aguarde a execução atual antes de preparar outro pedido.'); return }
    setPrompt(value); setAgentMode(mode)
    window.requestAnimationFrame(() => { composerRef.current?.focus(); composerRef.current?.setSelectionRange(value.length, value.length) })
  }

  function notify(message: string) {
    setNotice(message)
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3_200)
  }

  function handleChatScroll() {
    const scroller = chatScrollRef.current
    if (!scroller) return
    const atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 96
    stickToBottomRef.current = atBottom
    if (atBottom) setNewContent(false)
  }

  function jumpToLatest() {
    const scroller = chatScrollRef.current
    if (!scroller) return
    stickToBottomRef.current = true; setNewContent(false)
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  async function attachFiles() {
    if (interactionLocked()) { store.setError('Aguarde a execução atual terminar antes de anexar arquivos.'); return }
    let conversationId = useAppStore.getState().activeId
    if (!conversationId) {
      await createConversation()
      conversationId = useAppStore.getState().activeId
    }
    if (!conversationId) return
    try {
      const selected = await window.nocturne.files.attach(conversationId)
      setAttachments((current) => [...current, ...selected.filter((file) => !current.some((attached) => attached.path === file.path))].slice(0, 10))
    }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function cancelRun() {
    if (!store.activeId) return
    try { await window.nocturne.codex.interrupt(store.activeId) }
    catch (error) { store.setError(errorMessage(error)) }
  }

  function handleCodexEvent(event: CodexEvent) {
    routeCodexEvent(event, { stream: queueStreamDelta, activityDetail: appendActivityDetail, diff: store.setDiff, plan: store.setPlan, hasPlan: () => Boolean(useAppStore.getState().plan.length), itemStarted: addItemActivity, itemCompleted: completeItem, fsChanged: (paths) => { if (paths.length) store.upsertActivity({ id: 'fs-summary', type: 'file', label: `${paths.length} arquivo(s) observado(s)`, detail: paths.slice(-50).join('\n'), status: 'completed' }) }, approval: (value) => store.addApproval({ ...value, status: 'pending' }), turnCompleted: (params) => { void finishTurn(params).catch((error) => { store.setStatus('failed'); store.setError(`Falha ao finalizar a resposta: ${errorMessage(error)}`) }) }, error: (message) => { store.setError(message); store.upsertActivity({ id: `error-${Date.now()}`, type: 'error', label: 'Erro na execução', detail: message, status: 'failed' }) }, warning: (message) => store.upsertActivity({ id: `warning-${Date.now()}`, type: 'error', label: 'Aviso do Codex', detail: message, status: 'failed' }) })
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
    if (!store.activeId || interactionLocked()) return
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
    if (interactionLocked()) { store.setError('Aguarde a resposta ser concluída antes de excluir conversas.'); return }
    const conversation = store.conversations.find((item) => item.id === id)
    if (!await confirmation.confirm({ title: 'Excluir conversa?', description: `“${conversation?.title || 'Esta conversa'}” e seu histórico local serão removidos. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir conversa', danger: true })) return
    await window.nocturne.conversations.delete(id)
    if (store.activeId === id) { store.setActive(null); store.setMessages([]); store.setArtifacts([]); setPreview(null) }
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
    try { const saved = await window.nocturne.settings.set(next); setSettings({ ...next, ...saved }); setAgentMode(next.defaultAgentMode || 'review'); setSettingsOpen(false); notify('Configurações salvas.') }
    catch (error) { throw new Error(errorMessage(error)) }
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
    const conversationId = useAppStore.getState().activeId
    if (!conversationId) return
    if (!await confirmation.confirm({ title: 'Remover artefato?', description: 'O item será removido do painel. Arquivos existentes no workspace não serão apagados.', confirmLabel: 'Remover', danger: true })) return
    const previous = useAppStore.getState().artifacts
    store.setArtifacts(previous.filter((artifact) => artifact.id !== artifactId))
    try {
      await window.nocturne.artifacts.delete(conversationId, artifactId)
      if (useAppStore.getState().activeId === conversationId) store.setArtifacts(await window.nocturne.artifacts.list(conversationId))
      if (preview) setPreview(null)
    } catch (error) {
      if (useAppStore.getState().activeId === conversationId) store.setArtifacts(previous)
      store.setError(errorMessage(error))
    }
  }

  async function refreshArtifacts() { if (store.activeId) store.setArtifacts(await window.nocturne.artifacts.list(store.activeId)) }

  async function saveMemory(content: string, rules: string) {
    if (!store.activeId) return
    try { setMemory(await window.nocturne.memory.set(store.activeId, content, rules)); setMemoryOpen(false); notify('Contexto do workspace salvo.') }
    catch (error) { throw new Error(errorMessage(error)) }
  }

  async function reconnect() {
    try { store.setError(null); await window.nocturne.codex.start(); if (store.activeId) await window.nocturne.codex.resume(store.activeId); notify('Conexão com o Codex restabelecida.') }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function recheckReadiness() {
    try {
      await window.nocturne.codex.start()
      const refreshed = await window.nocturne.settings.check()
      const normalized = { ...refreshed, model: refreshed.model || '', sandbox: refreshed.sandbox || 'workspace-write', approvalPolicy: refreshed.approvalPolicy === 'untrusted' ? 'untrusted' : 'on-request', theme: 'dark', defaultAgentMode: refreshed.defaultAgentMode || 'review' } as CodexSettings
      setSettings(normalized); store.setStatus(normalized.serverStatus || useAppStore.getState().status)
      notify('Verificações de prontidão atualizadas.')
    } catch (error) { store.setError(errorMessage(error)) }
  }

  async function openWorkspaceTool(tool: 'editor' | 'terminal') {
    if (!pathLabel) return
    try { await window.nocturne.workspace.openTool(pathLabel, tool); notify(tool === 'editor' ? 'Workspace aberto no editor.' : 'Terminal aberto no workspace.') }
    catch (error) { store.setError(errorMessage(error)) }
  }

  async function favoriteWorkspace(item: Workspace) {
    try { await window.nocturne.workspace.favorite(item.path, !item.favorite); setWorkspaces(await window.nocturne.workspace.list()); notify(item.favorite ? 'Workspace removido dos favoritos.' : 'Workspace adicionado aos favoritos.') }
    catch (error) { store.setError(errorMessage(error)) }
  }

  const title = active?.title ?? 'Nova conversa'
  const pathLabel = active?.workspace ?? workspace
  const connectionSymbol = store.status === 'ready' || store.status === 'completed' ? 'ready' : store.status === 'failed' || store.status === 'disconnected' ? 'unavailable' : store.status === 'waiting-approval' ? 'attention' : 'busy'

  return <div className="app-shell">
    {compactLayout && sidebarOpen && <button tabIndex={-1} className="panel-backdrop sidebar-backdrop" aria-label="Fechar barra lateral" onClick={() => setSidebarVisibility(false)}/>}
    <Sidebar open={sidebarOpen} compact={compactLayout} triggerRef={sidebarTriggerRef} conversations={filtered} hasConversations={store.conversations.length > 0} activeId={store.activeId} search={search} searchRef={searchRef} workspace={workspace} workspaces={workspaces} settings={settings} status={store.status} onClose={() => setSidebarVisibility(false)} onNew={() => void createConversation().finally(() => { if (compactLayout) setSidebarVisibility(false) })} onSearch={setSearch} onConversation={(id) => void openConversation(id).finally(() => { if (compactLayout) setSidebarVisibility(false) })} onDelete={(id) => void removeConversation(id)} onWorkspace={() => void selectWorkspace().finally(() => { if (compactLayout) setSidebarVisibility(false) })} onSavedWorkspace={(path) => void chooseSavedWorkspace(path).finally(() => { if (compactLayout) setSidebarVisibility(false) })} onFavorite={(item) => void favoriteWorkspace(item)} onSettings={() => { if (compactLayout) setSidebarVisibility(false); setSettingsOpen(true) }}/>

    <main className="main-panel">
      <header className="topbar">
        {!sidebarOpen && <button ref={sidebarTriggerRef} className="icon-button" aria-label="Abrir barra lateral" title="Abrir barra lateral" aria-controls="workspace-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarVisibility(true)}><Menu size={18}/></button>}
        <div className="title-block"><h1 title={title}>{title}</h1>{pathLabel && <button className="path-pill" title={pathLabel} onClick={selectWorkspace}><Folder size={13}/><span>{pathLabel.split(/[/\\]/).pop()}</span><ChevronRight size={12}/></button>}</div>
        <div className="top-actions">{gitInfo && <span className="branch-pill top-action-branch"><GitBranch size={12}/>{gitInfo.branch}</span>}{pathLabel && <><button className="icon-button top-action-workspace" aria-label="Abrir no VS Code" title="Abrir no VS Code" onClick={() => void openWorkspaceTool('editor')}><Code2 size={16}/></button><button className="icon-button top-action-workspace" aria-label="Abrir terminal" title="Abrir terminal" onClick={() => void openWorkspaceTool('terminal')}><Terminal size={16}/></button></>}<button className={`connection top-action-essential ${store.status}`} onClick={reconnect} aria-label={`Codex: ${statusText(store.status)}. Reconectar`} title="Reconectar ao App Server"><span/><i className={`connection-symbol ${connectionSymbol}`} data-symbol={connectionSymbol} aria-hidden="true">{connectionSymbol === 'ready' ? <Check size={16}/> : connectionSymbol === 'attention' ? <AlertTriangle size={15}/> : connectionSymbol === 'busy' ? <LoaderCircle size={16}/> : <X size={16}/>}</i>{statusText(store.status)}</button><button className={`icon-button top-action-essential ${memory.content ? 'has-memory' : ''}`} aria-label="Memória do workspace" onClick={() => store.activeId ? setMemoryOpen(true) : store.setError('Abra uma conversa para configurar a memória do workspace.')} title="Memória do workspace"><Brain size={17}/></button><button className="icon-button top-action-secondary" aria-label="Abrir configurações" title="Abrir configurações" onClick={() => setSettingsOpen(true)}><Settings size={17}/></button>{(!compactLayout || !rightOpen) && <button ref={inspectorTriggerRef} className={`icon-button top-action-essential ${rightOpen ? 'selected' : ''}`} aria-label={rightOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} title={rightOpen ? 'Ocultar painel do agente' : 'Mostrar painel do agente'} aria-controls="agent-inspector" aria-expanded={rightOpen} onClick={() => setInspectorVisibility(!rightOpen)}><PanelRight size={18}/></button>}</div>
      </header>

      <section ref={chatScrollRef} className="chat-scroll" onScroll={handleChatScroll}>
        {!store.activeId && !store.messages.length ? <div className="chat-content welcome-content"><Welcome onNew={createConversation} onWorkspace={selectWorkspace} onPrompt={preparePrompt}/>{store.error && <div className="error-card" role="alert" aria-live="assertive"><X size={16}/><span>{store.error}</span><button onClick={() => store.setError(null)}>Fechar</button></div>}</div> : <div className="chat-content">
          {store.messages.map((message, index) => <Fragment key={message.id}>{(index === 0 || dayKey(store.messages[index - 1].createdAt) !== dayKey(message.createdAt)) && <div className="date-divider"><span>{dayLabel(message.createdAt)}</span></div>}<MessageBubble message={message}/></Fragment>) }
          {store.streaming && <AssistantMessage content={store.streaming} streaming/>}
          {store.error && <div className="error-card" role="alert" aria-live="assertive"><X size={16}/><span>{store.error}</span><button onClick={() => store.setError(null)}>Fechar</button></div>}
          <div ref={endRef}/>
        </div>}
      </section>
      {newContent && <button className="jump-latest" onClick={jumpToLatest}><ArrowDown size={15}/><span>Nova resposta disponível</span></button>}

      <Composer agentMode={agentMode} attachments={attachments} prompt={prompt} status={store.status} finalizing={store.finalizing} settings={settings} active={Boolean(store.activeId)} pendingApprovals={store.approvals.filter((item) => item.status === 'pending').length} composerRef={composerRef} onMode={setAgentMode} onPrompt={setPrompt} onRemoveAttachment={(path) => setAttachments((current) => current.filter((file) => file.path !== path))} onAttach={attachFiles} onCancel={cancelRun} onSubmit={send} onQuick={preparePrompt}/>
    </main>
    {compactLayout && rightOpen && <button tabIndex={-1} className="panel-backdrop inspector-backdrop" aria-label="Fechar painel do agente" onClick={() => setInspectorVisibility(false)}/>}

    <Suspense fallback={null}><AgentPanel open={rightOpen} compact={compactLayout} triggerRef={inspectorTriggerRef} activities={store.activities} approvals={store.approvals} diff={store.diff} files={store.files} artifacts={store.artifacts} suggestions={store.suggestions} plan={store.plan} planExplanation={store.planExplanation} activeId={store.activeId} gitInfo={gitInfo} documentContent={documentContent} onClose={() => setInspectorVisibility(false)} onDecide={decide} onError={store.setError} onNotify={notify} onGitRefresh={refreshGit} onArtifactsRefresh={refreshArtifacts} onPreview={showFilePreview} onArtifact={showArtifact} onDeleteArtifact={deleteArtifact} onSuggestionStatus={updateSuggestion} onSuggestionApply={applySuggestion} onPlanChange={(plan) => store.setPlan(plan, store.planExplanation)} onPlanExecute={(plan) => preparePrompt(`Execute o plano aprovado abaixo. Siga os passos na ordem, atualize o progresso e teste as alterações.\n\n${plan.map((item, index) => `${index + 1}. ${item.step}`).join('\n')}`, 'build')}/></Suspense>
    <Suspense fallback={null}>{settingsOpen && <SettingsDialog
      value={settings}
      status={store.status}
      workspaces={workspaces}
      onClose={() => setSettingsOpen(false)}
      onSave={saveSettings}
      onNotify={notify}
      onOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true) }}
    />}</Suspense>
    {confirmation.dialog}<Suspense fallback={null}>
    {memoryOpen && <MemoryDialog value={memory} onClose={() => setMemoryOpen(false)} onSave={saveMemory}/>}
    {preview && <PreviewDialog preview={preview} activeId={store.activeId} onClose={() => setPreview(null)} onError={store.setError} onNotify={notify}/>}
    {onboardingOpen && <OnboardingDialog settings={settings} status={store.status} hasWorkspace={Boolean(workspace)} onWorkspace={selectWorkspace} onSettings={() => { setOnboardingOpen(false); setSettingsOpen(true) }} onRecheck={recheckReadiness} onDismiss={() => { setOnboardingOpen(false); composerRef.current?.focus() }} onComplete={() => { localStorage.setItem('nocturne.onboarding.completed', 'true'); setOnboardingOpen(false); notify('Nocturne pronto para trabalhar.'); composerRef.current?.focus() }}/>}
    </Suspense>{notice && <div className="product-toast" role="status" aria-live="polite"><span>{notice}</span><button aria-label="Fechar notificação" onClick={() => setNotice(null)}><X size={14}/></button></div>}
  </div>
}

export default App
