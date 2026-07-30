import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { ArrowDown, X } from 'lucide-react'
import type { Message } from '../../types'
import { useAppStore } from '../../store'
import { AssistantMessage, MessageBubble, Welcome } from './ChatContent'

const dayKey = (value: string) => new Date(value).toLocaleDateString('pt-BR')
const dayLabel = (value: string) => {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(date)
}

interface ChatViewportProps {
  active: boolean
  messages: Message[]
  error: string | null
  historyHasMore: boolean
  historyHasNewer: boolean
  historyLoading: boolean
  newContent: boolean
  chatScrollRef: RefObject<HTMLElement | null>
  endRef: RefObject<HTMLDivElement | null>
  stickToBottomRef: MutableRefObject<boolean>
  onNew(): void
  onWorkspace(): void
  onPrompt(prompt: string): void
  onLoadOlder(): void
  onLoadLatest(): void
  onScroll(): void
  onNewContent(value: boolean): void
  onDismissError(): void
  onJumpLatest(): void
}

function StreamingResponse({ chatScrollRef, stickToBottomRef, onNewContent }: Pick<ChatViewportProps, 'chatScrollRef' | 'stickToBottomRef' | 'onNewContent'>) {
  const streaming = useAppStore((state) => state.streaming)
  useEffect(() => {
    const scroller = chatScrollRef.current
    if (!scroller || !streaming) return
    if (stickToBottomRef.current) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'auto' })
      onNewContent(false)
    } else onNewContent(true)
  }, [chatScrollRef, onNewContent, stickToBottomRef, streaming])
  return streaming ? <AssistantMessage content={streaming} streaming/> : null
}

export function ChatViewport({ active, messages, error, historyHasMore, historyHasNewer, historyLoading, newContent, chatScrollRef, endRef, stickToBottomRef, onNew, onWorkspace, onPrompt, onLoadOlder, onLoadLatest, onScroll, onNewContent, onDismissError, onJumpLatest }: ChatViewportProps) {
  return <>
    <section ref={chatScrollRef} className="chat-scroll" aria-label="Histórico da conversa" onScroll={onScroll}>
      {!active && !messages.length ? <div className="chat-content welcome-content"><Welcome onNew={onNew} onWorkspace={onWorkspace} onPrompt={onPrompt}/>{error && <div className="error-card" role="alert" aria-live="assertive"><X size={16}/><span>{error}</span><button onClick={onDismissError}>Fechar</button></div>}</div> : <div className="chat-content">
        {historyHasMore && <button className="load-history" disabled={historyLoading} onClick={onLoadOlder}>{historyLoading ? 'Carregando histórico…' : 'Carregar mensagens anteriores'}</button>}
        {messages.map((message, index) => <div className="message-entry" data-message-id={message.id} key={message.id}>{(index === 0 || dayKey(messages[index - 1].createdAt) !== dayKey(message.createdAt)) && <div className="date-divider"><span>{dayLabel(message.createdAt)}</span></div>}<MessageBubble message={message}/></div>)}
        {historyHasNewer && <button className="load-history" onClick={onLoadLatest}>Voltar às mensagens mais recentes</button>}
        <StreamingResponse chatScrollRef={chatScrollRef} stickToBottomRef={stickToBottomRef} onNewContent={onNewContent}/>
        {error && <div className="error-card" role="alert" aria-live="assertive"><X size={16}/><span>{error}</span><button onClick={onDismissError}>Fechar</button></div>}
        <div ref={endRef}/>
      </div>}
    </section>
    {newContent && <button className="jump-latest" onClick={onJumpLatest}><ArrowDown size={15}/><span>Nova resposta disponível</span></button>}
  </>
}
