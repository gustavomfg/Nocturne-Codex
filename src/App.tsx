import { FormEvent, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X } from 'lucide-react'
import { useAppStore } from './store'
import type { Activity, AgentMode, Artifact, Attachment, ChangedFile, CodexEvent, CodexSettings, FilePreview, GitInfo, PlanStep, Suggestion, SuggestionStatus, Workspace, WorkspaceMemory } from './types'
import { Sidebar } from './domains/workspaces/Sidebar'
import { WorkspaceTopbar } from './domains/workspaces/WorkspaceTopbar'
import { Composer } from './domains/chat/Composer'
import { ChatViewport } from './domains/chat/ChatViewport'
import { errorMessage, isBusy } from './shared/format'
import { UI_TIMING } from '../shared/constants'
import { useTurnLifecycle, type ActiveTurnContext } from './domains/agent/useTurnLifecycle'
import { routeCodexEvent } from './domains/agent/routeCodexEvent'
import { useBufferedCodexEvents } from './domains/agent/useBufferedCodexEvents'
import { useConfirmDialog } from './shared/ConfirmDialog'
import { useResponsivePanels } from './shared/useResponsivePanels'
import { AppOverlays } from './domains/settings/AppOverlays'
import { loadSettingsDialog } from './domains/settings/loadSettingsDialog'
import { usePagedCollections } from './domains/collections/usePagedCollections'
import './styles/components.css'
import './domains/settings/settings.css'
import './domains/agent/agent.css'
import './domains/memory/memory.css'
import './styles/product-constraints.css'

const now = () => new Date().toISOString()
const fakeId = () => crypto.randomUUID()
const AgentPanel = lazy(() => import('./domains/agent/AgentPanel').then((module) => ({ default: module.AgentPanel })))
const BrainMemoryDialog = lazy(() => import('./domains/memory/BrainMemoryDialog').then((module) => ({ default: module.BrainMemoryDialog })))

function App() {
  const store = useAppStore(useShallow((state) => ({
    conversations: state.conversations, activeId: state.activeId, messages: state.messages, status: state.status, finalizing: state.finalizing, approvals: state.approvals, error: state.error,
    setConversations: state.setConversations, setActive: state.setActive, setMessages: state.setMessages, addMessage: state.addMessage, setStatus: state.setStatus, setFinalizing: state.setFinalizing,
    clearRun: state.clearRun, setDiff: state.setDiff, upsertActivity: state.upsertActivity, addApproval: state.addApproval, resolveApproval: state.resolveApproval, setError: state.setError,
    setFiles: state.setFiles, setArtifacts: state.setArtifacts, setSuggestions: state.setSuggestions, setPlan: state.setPlan,
  })))
  const confirmation = useConfirmDialog()
  const [workspace, setWorkspace] = useState('')
  const [prompt, setPrompt] = useState('')
  const [search, setSearch] = useState('')
  const { compact: compactLayout, inspectorOpen: rightOpen, sidebarOpen, setInspectorVisibility, setSidebarVisibility } = useResponsivePanels()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<CodexSettings>({ model: '', sandbox: 'workspace-write', approvalPolicy: 'on-request', theme: 'dark', defaultAgentMode: 'review' })
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [memory, setMemory] = useState<WorkspaceMemory>({ content: '', rules: '', updatedAt: '' })
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [brainOpen, setBrainOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('nocturne.onboarding.completed') !== 'true')
  const [agentMode, setAgentMode] = useState<AgentMode>('review')
  const [newContent, setNewContent] = useState(false)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLElement>(null)
  const stickToBottomRef = useRef(true)
  const noticeTimerRef = useRef<number | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null)
  const inspectorTriggerRef = useRef<HTMLButtonElement>(null)
  const { queueStreamDelta, flushStream, appendActivityDetail, addItemActivity, completeItem } = useBufferedCodexEvents()
  const activeTurnRef = useRef<ActiveTurnContext | null>(null)
  const applyingSuggestionRef = useRef<{ id: string; affectedFiles: string[] } | null>(null)
  const conversationRequestRef = useRef(0)
  const historyOffsetRef = useRef(0)
  const active = store.conversations.find((item) => item.id === store.activeId)
  const filtered = store.conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) && (!workspace || item.workspace === workspace))
  const finishTurn = useTurnLifecycle({ flushStream, activeTurnRef, refreshGit })
  const collections = usePagedCollections(store.setError)
  const interactionLocked = () => { const state = useAppStore.getState(); return isBusy(state.status) || state.finalizing }

  const refresh = collections.refreshConversations

  useEffect(() => {
    void Promise.all([window.nocturne.conversations.page(), window.nocturne.workspace.list(), window.nocturne.settings.get()]).then(async ([conversationPage, savedWorkspaces, savedSettings]) => {
      const conversations = conversationPage.items
      const normalized = { ...savedSettings, model: savedSettings.model || '', sandbox: savedSettings.sandbox || 'workspace-write', approvalPolicy: savedSettings.approvalPolicy === 'untrusted' ? 'untrusted' : 'on-request', theme: 'dark', defaultAgentMode: savedSettings.defaultAgentMode || 'review' } as CodexSettings
      store.setConversations(conversations); void collections.initializeConversationHasMore(conversationPage.hasMore); store.setStatus(normalized.serverStatus || 'disconnected'); setWorkspaces(savedWorkspaces); setSettings(normalized); setAgentMode(normalized.defaultAgentMode || 'review')
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
    const scroller = chatScrollRef.current
    if (!scroller) return
    if (stickToBottomRef.current) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      setNewContent(false)
    }
  }, [store.messages])
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
    await refresh(); store.setActive(conversation.id); store.setMessages([]); store.clearRun(); historyOffsetRef.current = 0; setHistoryHasMore(false); setWorkspace(selected)
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
    const page = await window.nocturne.conversations.messagePage(id)
    const messages = page.items
    if (requestId !== conversationRequestRef.current || useAppStore.getState().activeId !== id) return
    store.setMessages(messages); historyOffsetRef.current = messages.length; setHistoryHasMore(page.hasMore)
    const lastMetadata = [...messages].reverse().find((message) => message.metadata)?.metadata
    if (lastMetadata) restoreMetadata(lastMetadata)
    const conversation = conversations.find((item) => item.id === id)
    if (conversation) setWorkspace(conversation.workspace)
    await collections.loadConversationCollections(id)
    if (requestId !== conversationRequestRef.current || useAppStore.getState().activeId !== id) return
    setPreview(null)
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

  async function loadOlderMessages() {
    const conversationId = useAppStore.getState().activeId
    if (!conversationId || historyLoading || !historyHasMore) return
    const scroller = chatScrollRef.current
    const previousHeight = scroller?.scrollHeight ?? 0
    setHistoryLoading(true)
    try {
      const page = await window.nocturne.conversations.messagePage(conversationId, historyOffsetRef.current)
      if (useAppStore.getState().activeId !== conversationId) return
      const current = useAppStore.getState().messages
      const known = new Set(current.map((message) => message.id))
      const older = page.items.filter((message) => !known.has(message.id))
      store.setMessages([...older, ...current])
      historyOffsetRef.current += page.items.length
      setHistoryHasMore(page.hasMore)
      window.requestAnimationFrame(() => { if (scroller) scroller.scrollTop += scroller.scrollHeight - previousHeight })
    } catch (error) { store.setError(errorMessage(error)) }
    finally { if (useAppStore.getState().activeId === conversationId) setHistoryLoading(false) }
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
    activeTurnRef.current = { conversationId, mode, suggestionId: applyingSuggestionRef.current?.id ?? null, suggestionFiles: applyingSuggestionRef.current?.affectedFiles ?? [] }
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

  async function persistSuggestionStatus(suggestion: Suggestion, status: SuggestionStatus) {
    if (!store.activeId) throw new Error('Abra a conversa da sugestão antes de registrar a decisão.')
    await window.nocturne.suggestions.status(store.activeId, suggestion.id, status)
    await collections.refreshSuggestions(store.activeId)
  }

  async function updateSuggestion(suggestion: Suggestion, status: SuggestionStatus) {
    try { await persistSuggestionStatus(suggestion, status) }
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
    try { await persistSuggestionStatus(suggestion, 'accepted') }
    catch (error) { store.setError(`A sugestão não foi aceita: ${errorMessage(error)}`); return }
    store.setPlan(steps, `Aplicação da sugestão: ${suggestion.title}`)
    applyingSuggestionRef.current = { id: suggestion.id, affectedFiles: suggestion.affectedFiles }
    await submitPrompt(`Aplique a sugestão aprovada abaixo. Não amplie o escopo. Antes de editar, confirme os arquivos afetados; depois execute typecheck, lint e testes relacionados quando disponíveis.\n\nTítulo: ${suggestion.title}\nProblema: ${suggestion.description}\nJustificativa: ${suggestion.reasoning}\nArquivos: ${suggestion.affectedFiles.join(', ') || 'identificar antes de editar'}\nProposta:\n${suggestion.proposedChanges}`, 'build')
  }

  async function removeConversation(id: string) {
    if (interactionLocked()) { store.setError('Aguarde a resposta ser concluída antes de excluir conversas.'); return }
    const conversation = store.conversations.find((item) => item.id === id)
    if (!await confirmation.confirm({ title: 'Excluir conversa?', description: `“${conversation?.title || 'Esta conversa'}” e seu histórico local serão removidos. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir conversa', danger: true })) return
    await window.nocturne.conversations.delete(id)
    if (store.activeId === id) { store.setActive(null); store.setMessages([]); store.setArtifacts([]); historyOffsetRef.current = 0; setHistoryHasMore(false); setPreview(null) }
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
      if (useAppStore.getState().activeId === conversationId) await collections.refreshArtifacts(conversationId)
      if (preview) setPreview(null)
    } catch (error) {
      if (useAppStore.getState().activeId === conversationId) store.setArtifacts(previous)
      store.setError(errorMessage(error))
    }
  }

  async function refreshArtifacts() { await collections.refreshArtifacts(store.activeId) }

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

  return <div className="app-shell">
    {compactLayout && sidebarOpen && <button tabIndex={-1} className="panel-backdrop sidebar-backdrop" aria-label="Fechar barra lateral" onClick={() => setSidebarVisibility(false)}/>}
    <Sidebar open={sidebarOpen} compact={compactLayout} triggerRef={sidebarTriggerRef} conversations={filtered} hasConversations={store.conversations.length > 0} hasMore={collections.conversationHasMore} loadingMore={collections.loading === 'conversations'} activeId={store.activeId} search={search} searchRef={searchRef} workspace={workspace} workspaces={workspaces} settings={settings} status={store.status} onClose={() => setSidebarVisibility(false)} onNew={() => void createConversation().finally(() => { if (compactLayout) setSidebarVisibility(false) })} onSearch={setSearch} onLoadMore={() => void collections.loadMoreConversations()} onConversation={(id) => void openConversation(id).finally(() => { if (compactLayout) setSidebarVisibility(false) })} onDelete={(id) => void removeConversation(id)} onWorkspace={() => void selectWorkspace().finally(() => { if (compactLayout) setSidebarVisibility(false) })} onSavedWorkspace={(path) => void chooseSavedWorkspace(path).finally(() => { if (compactLayout) setSidebarVisibility(false) })} onFavorite={(item) => void favoriteWorkspace(item)} onSettings={() => { if (compactLayout) setSidebarVisibility(false); setSettingsOpen(true) }}/>

    <main className="main-panel">
      <WorkspaceTopbar title={title} pathLabel={pathLabel} gitInfo={gitInfo} status={store.status} sidebarOpen={sidebarOpen} inspectorOpen={rightOpen} compact={compactLayout} hasMemory={Boolean(memory.content)} sidebarTriggerRef={sidebarTriggerRef} inspectorTriggerRef={inspectorTriggerRef} onOpenSidebar={() => setSidebarVisibility(true)} onSelectWorkspace={() => void selectWorkspace()} onOpenTool={(tool) => void openWorkspaceTool(tool)} onReconnect={() => void reconnect()} onMemory={() => store.activeId ? setMemoryOpen(true) : store.setError('Abra uma conversa para configurar a memória do workspace.')} onSettings={() => setSettingsOpen(true)} onToggleInspector={() => setInspectorVisibility(!rightOpen)}/>

      <ChatViewport active={Boolean(store.activeId)} messages={store.messages} error={store.error} historyHasMore={historyHasMore} historyLoading={historyLoading} newContent={newContent} chatScrollRef={chatScrollRef} endRef={endRef} stickToBottomRef={stickToBottomRef} onNew={() => void createConversation()} onWorkspace={() => void selectWorkspace()} onPrompt={preparePrompt} onLoadOlder={() => void loadOlderMessages()} onScroll={handleChatScroll} onNewContent={setNewContent} onDismissError={() => store.setError(null)} onJumpLatest={jumpToLatest}/>

      <Composer agentMode={agentMode} attachments={attachments} prompt={prompt} status={store.status} finalizing={store.finalizing} settings={settings} active={Boolean(store.activeId)} pendingApprovals={store.approvals.filter((item) => item.status === 'pending').length} composerRef={composerRef} onMode={setAgentMode} onPrompt={setPrompt} onRemoveAttachment={(path) => setAttachments((current) => current.filter((file) => file.path !== path))} onAttach={attachFiles} onCancel={cancelRun} onSubmit={send} onQuick={preparePrompt}/>
    </main>
    {compactLayout && rightOpen && <button tabIndex={-1} className="panel-backdrop inspector-backdrop" aria-label="Fechar painel do agente" onClick={() => setInspectorVisibility(false)}/>}

    <Suspense fallback={null}><AgentPanel open={rightOpen} compact={compactLayout} triggerRef={inspectorTriggerRef} gitInfo={gitInfo} artifactsHaveMore={collections.artifactHasMore} suggestionsHaveMore={collections.suggestionHasMore} loadingCollection={collections.loading} onClose={() => setInspectorVisibility(false)} onDecide={decide} onError={store.setError} onNotify={notify} onGitRefresh={refreshGit} onArtifactsRefresh={refreshArtifacts} onLoadMoreArtifacts={() => void collections.loadMoreArtifacts()} onLoadMoreSuggestions={() => void collections.loadMoreSuggestions()} onPreview={showFilePreview} onArtifact={showArtifact} onDeleteArtifact={deleteArtifact} onSuggestionStatus={updateSuggestion} onSuggestionApply={applySuggestion} onPlanChange={(plan) => store.setPlan(plan, useAppStore.getState().planExplanation)} onPlanExecute={(plan) => preparePrompt(`Execute o plano aprovado abaixo. Siga os passos na ordem, atualize o progresso e teste as alterações.\n\n${plan.map((item, index) => `${index + 1}. ${item.step}`).join('\n')}`, 'build')}/></Suspense>
    {confirmation.dialog}<AppOverlays settingsOpen={settingsOpen} settings={settings} status={store.status} workspaces={workspaces} memoryOpen={memoryOpen} memory={memory} preview={preview} onboardingOpen={onboardingOpen} activeId={store.activeId} workspace={workspace} onSettingsClose={() => setSettingsOpen(false)} onSaveSettings={saveSettings} onNotify={notify} onOpenOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true) }} onMemoryClose={() => setMemoryOpen(false)} onOpenBrain={() => { setMemoryOpen(false); setBrainOpen(true) }} onSaveMemory={saveMemory} onPreviewClose={() => setPreview(null)} onError={store.setError} onWorkspace={selectWorkspace} onOpenSettings={() => { setOnboardingOpen(false); setSettingsOpen(true) }} onRecheck={recheckReadiness} onDismissOnboarding={() => { setOnboardingOpen(false); composerRef.current?.focus() }} onCompleteOnboarding={() => { localStorage.setItem('nocturne.onboarding.completed', 'true'); setOnboardingOpen(false); notify('Nocturne pronto para trabalhar.'); composerRef.current?.focus() }}/><Suspense fallback={null}>{brainOpen && store.activeId && <BrainMemoryDialog conversationId={store.activeId} onClose={() => setBrainOpen(false)} onNotify={notify}/>}</Suspense>{notice && <div className="product-toast" role="status" aria-live="polite"><span>{notice}</span><button aria-label="Fechar notificação" onClick={() => setNotice(null)}><X size={14}/></button></div>}
  </div>
}

export default App
