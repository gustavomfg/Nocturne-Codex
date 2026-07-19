import { useRef, type MutableRefObject } from 'react'
import type { AgentMode } from '../../types'
import { useAppStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'

export interface ActiveTurnContext { conversationId: string; mode: AgentMode; suggestionId: string | null; suggestionFiles: string[] }

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
      const memoryExtraction = await window.nocturne.brain.extract(context.conversationId, assistantContent)
      assistantContent = memoryExtraction.content || (memoryExtraction.memories.length ? `${memoryExtraction.memories.length} candidata(s) foram enviadas ao Segundo Cérebro para sua revisão.` : 'A resposta do agente não continha conteúdo persistível.')
      if (memoryExtraction.warning) store.setError(memoryExtraction.warning)
      if (context.mode === 'review') {
        const extracted = await window.nocturne.suggestions.create(context.conversationId, assistantContent)
        assistantContent = extracted.content || assistantContent
        if (useAppStore.getState().activeId === context.conversationId) store.setSuggestions((await window.nocturne.suggestions.page(context.conversationId)).items)
      }
      const activitySnapshot = current.activities.slice(-100).map((activity) => ({ ...activity, detail: activity.detail?.slice(-4_000) }))
      const saved = await window.nocturne.codex.saveAssistant(context.conversationId, assistantContent, { diff: current.diff.slice(-500_000), activities: activitySnapshot, files: current.files.slice(-300), plan: current.plan.slice(-100), planExplanation: current.planExplanation.slice(-20_000) })
      if (useAppStore.getState().activeId === context.conversationId) store.addMessage(saved)
      useAppStore.setState({ streaming: '' })
      if (useAppStore.getState().activeId === context.conversationId) store.setArtifacts((await window.nocturne.artifacts.page(context.conversationId)).items)
    }
    if (context.suggestionId) {
      const changedInApprovedScope = hasAppliedSuggestionChanges(context.suggestionFiles, useAppStore.getState().files.map((file) => file.path))
      if (!error && changedInApprovedScope) await window.nocturne.suggestions.status(context.conversationId, context.suggestionId, 'applied', 'Turno concluído com alterações observadas no escopo aprovado; consulte a resposta do agente para os resultados de validação.')
      if (useAppStore.getState().activeId === context.conversationId) store.setSuggestions((await window.nocturne.suggestions.page(context.conversationId)).items)
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

export function hasAppliedSuggestionChanges(expectedFiles: string[], observedFiles: string[]) {
  if (!observedFiles.length) return false
  if (!expectedFiles.length) return true
  const observed = observedFiles.map(normalizePath)
  return expectedFiles.every((expectedFile) => {
    const expected = normalizePath(expectedFile)
    return observed.some((file) => file === expected || file.endsWith(`/${expected}`))
  })
}

function normalizePath(value: string) { return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '') }
