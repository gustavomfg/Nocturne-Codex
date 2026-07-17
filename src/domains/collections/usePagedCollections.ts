import { useState } from 'react'
import { COLLECTION_PAGE_LIMITS } from '../../../shared/constants'
import { useAppStore } from '../../store'
import { errorMessage } from '../../shared/format'

type Collection = 'conversations' | 'artifacts' | 'suggestions'

export function usePagedCollections(onError: (message: string) => void) {
  const [conversationHasMore, setConversationHasMore] = useState(false)
  const [artifactHasMore, setArtifactHasMore] = useState(false)
  const [suggestionHasMore, setSuggestionHasMore] = useState(false)
  const [loading, setLoading] = useState<Collection | null>(null)

  const fail = (error: unknown) => onError(errorMessage(error))

  async function refreshConversations() {
    const page = await window.nocturne.conversations.page()
    useAppStore.getState().setConversations(page.items); setConversationHasMore(page.hasMore)
    return page.items
  }

  async function initializeConversationHasMore(value: boolean) { setConversationHasMore(value) }

  async function loadConversationCollections(conversationId: string) {
    const [artifacts, suggestions] = await Promise.all([window.nocturne.artifacts.page(conversationId), window.nocturne.suggestions.page(conversationId)])
    if (useAppStore.getState().activeId !== conversationId) return
    useAppStore.getState().setArtifacts(artifacts.items); setArtifactHasMore(artifacts.hasMore)
    useAppStore.getState().setSuggestions(suggestions.items); setSuggestionHasMore(suggestions.hasMore)
  }

  async function refreshArtifacts(conversationId = useAppStore.getState().activeId) {
    if (!conversationId) return
    const page = await window.nocturne.artifacts.page(conversationId)
    if (useAppStore.getState().activeId !== conversationId) return
    useAppStore.getState().setArtifacts(page.items); setArtifactHasMore(page.hasMore)
  }

  async function refreshSuggestions(conversationId = useAppStore.getState().activeId) {
    if (!conversationId) return
    const page = await window.nocturne.suggestions.page(conversationId)
    if (useAppStore.getState().activeId !== conversationId) return
    useAppStore.getState().setSuggestions(page.items); setSuggestionHasMore(page.hasMore)
  }

  async function loadMoreConversations() {
    if (!conversationHasMore || loading) return
    setLoading('conversations')
    try {
      const current = useAppStore.getState().conversations
      const page = await window.nocturne.conversations.page(current.length, COLLECTION_PAGE_LIMITS.conversations)
      const known = new Set(current.map((item) => item.id))
      useAppStore.getState().setConversations([...current, ...page.items.filter((item) => !known.has(item.id))]); setConversationHasMore(page.hasMore)
    } catch (error) { fail(error) } finally { setLoading(null) }
  }

  async function loadMoreArtifacts() {
    const conversationId = useAppStore.getState().activeId
    if (!conversationId || !artifactHasMore || loading) return
    setLoading('artifacts')
    try {
      const current = useAppStore.getState().artifacts
      const page = await window.nocturne.artifacts.page(conversationId, current.length, COLLECTION_PAGE_LIMITS.artifacts)
      if (useAppStore.getState().activeId !== conversationId) return
      const known = new Set(current.map((item) => item.id))
      useAppStore.getState().setArtifacts([...current, ...page.items.filter((item) => !known.has(item.id))]); setArtifactHasMore(page.hasMore)
    } catch (error) { fail(error) } finally { setLoading(null) }
  }

  async function loadMoreSuggestions() {
    const conversationId = useAppStore.getState().activeId
    if (!conversationId || !suggestionHasMore || loading) return
    setLoading('suggestions')
    try {
      const current = useAppStore.getState().suggestions
      const page = await window.nocturne.suggestions.page(conversationId, current.length, COLLECTION_PAGE_LIMITS.suggestions)
      if (useAppStore.getState().activeId !== conversationId) return
      const known = new Set(current.map((item) => item.id))
      useAppStore.getState().setSuggestions([...current, ...page.items.filter((item) => !known.has(item.id))]); setSuggestionHasMore(page.hasMore)
    } catch (error) { fail(error) } finally { setLoading(null) }
  }

  return { conversationHasMore, artifactHasMore, suggestionHasMore, loading, initializeConversationHasMore, refreshConversations, loadConversationCollections, refreshArtifacts, refreshSuggestions, loadMoreConversations, loadMoreArtifacts, loadMoreSuggestions }
}
