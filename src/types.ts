export type Role = 'user' | 'assistant' | 'system'
export interface Conversation { id: string; title: string; workspace: string; codexThreadId: string | null; createdAt: string; updatedAt: string }
export interface Message { id: string; conversationId: string; role: Role; content: string; metadata: string | null; createdAt: string }
export interface Approval { key: string; kind: 'command' | 'file'; title: string; detail: string; status: 'pending' | 'accepted' | 'declined' }
export interface Activity { id: string; type: 'command' | 'file' | 'reasoning'; label: string; detail?: string; status: 'running' | 'completed' | 'failed' }
export interface CodexEvent { method: string; params: Record<string, unknown> }
export type CodexStatus = 'offline' | 'starting' | 'ready' | 'running' | 'error'

declare global {
  interface Window {
    nocturne: {
      workspace: { select(): Promise<string | null>; validate(value: string): Promise<string | null> }
      conversations: { list(): Promise<Conversation[]>; create(workspace: string): Promise<Conversation>; messages(id: string): Promise<Message[]>; delete(id: string): Promise<void> }
      codex: {
        start(): Promise<{ status: CodexStatus }>
        send(conversationId: string, prompt: string): Promise<{ threadId: string }>
        saveAssistant(conversationId: string, content: string, metadata?: unknown): Promise<Message>
        approve(key: string, accepted: boolean, forSession?: boolean): Promise<void>
        onEvent(listener: (event: CodexEvent) => void): () => void
        onStatus(listener: (status: { status: CodexStatus; error?: string }) => void): () => void
      }
    }
  }
}

