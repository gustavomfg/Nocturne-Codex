export type Role = 'user' | 'assistant' | 'system'
export interface Conversation { id: string; title: string; workspace: string; codexThreadId: string | null; createdAt: string; updatedAt: string }
export interface Workspace { path: string; name: string; createdAt: string; lastOpenedAt: string }
export interface Message { id: string; conversationId: string; role: Role; content: string; metadata: string | null; createdAt: string }
export interface Approval { key: string; kind: 'command' | 'file'; title: string; detail: string; status: 'pending' | 'accepted' | 'declined' }
export interface Activity { id: string; type: 'command' | 'file' | 'reasoning' | 'read' | 'error' | 'completion'; label: string; detail?: string; status: 'running' | 'completed' | 'failed' }
export interface ChangedFile { path: string; kind: 'created' | 'modified' | 'deleted'; status: string }
export interface Attachment { path: string; name: string; size: number }
export interface Artifact { id: string; conversationId: string; workspace: string; type: 'response' | 'file' | 'diff' | 'document'; title: string; filePath: string | null; content: string | null; metadata: string | null; createdAt: string; updatedAt: string }
export interface FilePreview { kind: 'text' | 'markdown' | 'image'; name: string; filePath: string; mime: string; content: string; size: number }
export interface WorkspaceMemory { content: string; updatedAt: string }
export interface PlanStep { step: string; status: 'pending' | 'inProgress' | 'completed' }
export interface GitInfo { branch: string; status: string; diff: string }
export interface CodexSettings { model: string; sandbox: 'read-only' | 'workspace-write'; approvalPolicy: 'untrusted' | 'on-request' | 'never'; codexPath?: string; codexVersion?: string; pandocVersion?: string; serverStatus?: CodexStatus }
export interface CodexEvent { method: string; params: Record<string, unknown> }
export type CodexStatus = 'offline' | 'starting' | 'ready' | 'running' | 'error'

declare global {
  interface Window {
    nocturne: {
      workspace: { select(): Promise<string | null>; validate(value: string): Promise<string | null>; list(): Promise<Workspace[]>; remove(value: string): Promise<void> }
      conversations: { list(): Promise<Conversation[]>; create(workspace: string): Promise<Conversation>; messages(id: string): Promise<Message[]>; delete(id: string): Promise<void> }
      codex: {
        start(): Promise<{ status: CodexStatus }>
        send(conversationId: string, prompt: string, attachments?: string[]): Promise<{ threadId: string; recreated: boolean }>
        resume(conversationId: string): Promise<{ resumed: boolean }>
        interrupt(conversationId: string): Promise<void>
        saveAssistant(conversationId: string, content: string, metadata?: unknown): Promise<Message>
        approve(key: string, accepted: boolean, forSession?: boolean): Promise<void>
        onEvent(listener: (event: CodexEvent) => void): () => void
        onStatus(listener: (status: { status: CodexStatus; error?: string }) => void): () => void
      }
      files: { attach(conversationId: string): Promise<Attachment[]>; open(conversationId: string, filePath: string, action: 'file' | 'folder' | 'editor'): Promise<void>; preview(conversationId: string, filePath: string): Promise<FilePreview> }
      memory: { get(conversationId: string): Promise<WorkspaceMemory>; set(conversationId: string, content: string): Promise<WorkspaceMemory> }
      artifacts: { list(conversationId: string): Promise<Artifact[]>; delete(conversationId: string, artifactId: string): Promise<void> }
      settings: { get(): Promise<CodexSettings>; set(settings: Pick<CodexSettings, 'model' | 'sandbox' | 'approvalPolicy'>): Promise<CodexSettings> }
      git: { status(conversationId: string): Promise<GitInfo>; commit(conversationId: string, message: string): Promise<{ output: string }> }
      documents: { saveMarkdown(conversationId: string, content: string, name?: string): Promise<string | null>; export(conversationId: string, content: string, format: 'docx' | 'pdf' | 'html'): Promise<string | null> }
    }
  }
}
