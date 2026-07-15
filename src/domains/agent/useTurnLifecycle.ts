import { useRef, type MutableRefObject } from 'react'
import type { AgentMode } from '../../types'
import { useAppStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'

export interface ActiveTurnContext { conversationId: string; mode: AgentMode; suggestionId: string | null }

export function useTurnLifecycle({ flushStream, activeTurnRef, refreshGit }: { flushStream(): void; activeTurnRef: MutableRefObject<ActiveTurnContext | null>; refreshGit(conversationId: string): void }) {
  const processingTurnsRef = useRef(new Set<string>())
  const persistedTurnsRef = useRef(new Set<string>())
  const store = useAppStore(useShallow((state) => ({
    setFinalizing: state.setFinalizing, setError: state.setError, upsertActivity: state.upsertActivity, setSuggestions: state.setSuggestions, addMessage: state.addMessage, setArtifacts: state.setArtifacts,
  })))

  return async (params: Record<string, unknown>) => {
    flushStream()
    const state = useAppStore.getState()
    const context = activeTurnRef.current
    const turn = params.turn as Record<string, unknown> | undefined
    const completionKey = String(turn?.id ?? `${params.threadId ?? 'thread'}:${state.streaming.length}`)
    if (!context || persistedTurnsRef.current.has(completionKey) || processingTurnsRef.current.has(completionKey)) return
    processingTurnsRef.current.add(completionKey)
    store.setFinalizing(true)
    try {
      const error = turn?.error as Record<string, unknown> | undefined
      if (error) store.setError(String(error.message ?? 'A execução não foi concluída.'))
      store.upsertActivity({ id: `completion-${String(turn?.id ?? Date.now())}`, type: 'completion', label: error ? 'Execução encerrada com erro' : 'Execução concluída', status: error ? 'failed' : 'completed' })
      if (state.streaming) {
      const current = useAppStore.getState()
      let assistantContent = state.streaming
      if (context.mode === 'review') {
        const extracted = await window.nocturne.suggestions.create(context.conversationId, assistantContent)
        assistantContent = extracted.content || assistantContent
        if (useAppStore.getState().activeId === context.conversationId) store.setSuggestions(await window.nocturne.suggestions.list(context.conversationId))
      }
      const activitySnapshot = current.activities.slice(-100).map((activity) => ({ ...activity, detail: activity.detail?.slice(-4_000) }))
      const saved = await window.nocturne.codex.saveAssistant(context.conversationId, assistantContent, { diff: current.diff.slice(-500_000), activities: activitySnapshot, files: current.files.slice(-300), plan: current.plan.slice(-100), planExplanation: current.planExplanation.slice(-20_000) })
      if (useAppStore.getState().activeId === context.conversationId) store.addMessage(saved)
      useAppStore.setState({ streaming: '' })
      if (useAppStore.getState().activeId === context.conversationId) store.setArtifacts(await window.nocturne.artifacts.list(context.conversationId))
    }
    if (context.suggestionId) {
      const changed = useAppStore.getState().files.length > 0 || Boolean(useAppStore.getState().diff)
      if (!error && changed) await window.nocturne.suggestions.status(context.conversationId, context.suggestionId, 'applied', 'Alteração executada; consulte a resposta do agente para resultados de validação.')
      if (useAppStore.getState().activeId === context.conversationId) store.setSuggestions(await window.nocturne.suggestions.list(context.conversationId))
    }
      refreshGit(context.conversationId)
      persistedTurnsRef.current.add(completionKey)
      if (persistedTurnsRef.current.size > 100) persistedTurnsRef.current.delete(persistedTurnsRef.current.values().next().value as string)
      if (activeTurnRef.current === context) activeTurnRef.current = null
    } finally {
      processingTurnsRef.current.delete(completionKey)
      store.setFinalizing(false)
    }
  }
}
