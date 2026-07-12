import { useRef, type MutableRefObject } from 'react'
import type { AgentMode } from '../../types'
import { useAppStore } from '../../store'

export function useTurnLifecycle({ flushStream, activeTurnModeRef, applyingSuggestionRef, refreshGit }: { flushStream(): void; activeTurnModeRef: MutableRefObject<AgentMode>; applyingSuggestionRef: MutableRefObject<string | null>; refreshGit(conversationId: string): void }) {
  const completedTurnsRef = useRef(new Set<string>())
  const store = useAppStore()

  return async (params: Record<string, unknown>) => {
    flushStream()
    const state = useAppStore.getState()
    const turn = params.turn as Record<string, unknown> | undefined
    const completionKey = String(turn?.id ?? `${params.threadId ?? 'thread'}:${state.streaming.length}`)
    if (completedTurnsRef.current.has(completionKey)) return
    completedTurnsRef.current.add(completionKey)
    if (completedTurnsRef.current.size > 100) completedTurnsRef.current.delete(completedTurnsRef.current.values().next().value as string)
    const error = turn?.error as Record<string, unknown> | undefined
    if (error) store.setError(String(error.message ?? 'A execução não foi concluída.'))
    store.upsertActivity({ id: `completion-${String(turn?.id ?? Date.now())}`, type: 'completion', label: error ? 'Execução encerrada com erro' : 'Execução concluída', status: error ? 'failed' : 'completed' })
    if (state.streaming && state.activeId) {
      const current = useAppStore.getState()
      let assistantContent = state.streaming
      if (activeTurnModeRef.current === 'review') {
        const extracted = await window.nocturne.suggestions.create(state.activeId, assistantContent)
        assistantContent = extracted.content || assistantContent
        store.setSuggestions(await window.nocturne.suggestions.list(state.activeId))
      }
      const activitySnapshot = current.activities.slice(-100).map((activity) => ({ ...activity, detail: activity.detail?.slice(-4_000) }))
      const saved = await window.nocturne.codex.saveAssistant(state.activeId, assistantContent, { diff: current.diff.slice(-500_000), activities: activitySnapshot, files: current.files.slice(-300), plan: current.plan.slice(-100), planExplanation: current.planExplanation.slice(-20_000) })
      store.addMessage(saved)
      useAppStore.setState({ streaming: '' })
      store.setArtifacts(await window.nocturne.artifacts.list(state.activeId))
    }
    if (applyingSuggestionRef.current && state.activeId) {
      const suggestionId = applyingSuggestionRef.current
      const changed = useAppStore.getState().files.length > 0 || Boolean(useAppStore.getState().diff)
      if (!error && changed) await window.nocturne.suggestions.status(state.activeId, suggestionId, 'applied', 'Alteração executada; consulte a resposta do agente para resultados de validação.')
      applyingSuggestionRef.current = null
      store.setSuggestions(await window.nocturne.suggestions.list(state.activeId))
    }
    if (state.activeId) refreshGit(state.activeId)
  }
}
