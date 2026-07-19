import type { AgentMode, Artifact, Attachment, CodexDiagnostics, CodexEvent, CodexSettings, CodexStatus, CollectionPage, Conversation, FilePreview, GitInfo, Message, MessagePage, Suggestion, SuggestionStatus, Workspace, WorkspaceMemory } from '../types'
import type { BrainMemory, BrainMemoryKind, BrainMemoryScope, BrainMemoryStatus, UpdateBrainMemoryInput } from '../brainMemory'

export interface NocturneApi {
  workspace: { select(expectedWorkspace?: string): Promise<string | null>; validate(value: string): Promise<string | null>; list(): Promise<Workspace[]>; remove(value: string): Promise<void>; favorite(value: string, favorite: boolean): Promise<void>; openTool(value: string, tool: 'editor' | 'terminal'): Promise<void> }
  conversations: { list(): Promise<Conversation[]>; page(offset?: number, limit?: number): Promise<CollectionPage<Conversation>>; create(workspace: string): Promise<Conversation>; messages(id: string): Promise<Message[]>; messagePage(id: string, offset?: number, limit?: number): Promise<MessagePage>; delete(id: string): Promise<void> }
  codex: { start(): Promise<{ status: CodexStatus }>; restart(): Promise<CodexDiagnostics>; diagnostics(): Promise<CodexDiagnostics>; send(conversationId: string, prompt: string, attachments?: string[], mode?: AgentMode): Promise<{ threadId: string; recreated: boolean }>; resume(conversationId: string): Promise<{ resumed: boolean }>; interrupt(conversationId: string): Promise<void>; saveAssistant(conversationId: string, content: string, metadata?: unknown): Promise<Message>; approve(key: string, accepted: boolean, forSession?: boolean): Promise<void>; onEvent(listener: (event: CodexEvent) => void): () => void; onStatus(listener: (status: { status: CodexStatus; error?: string }) => void): () => void }
  files: { attach(conversationId: string): Promise<Attachment[]>; open(conversationId: string, filePath: string, action: 'file' | 'folder' | 'editor'): Promise<void>; preview(conversationId: string, filePath: string): Promise<FilePreview> }
  memory: { get(conversationId: string): Promise<WorkspaceMemory>; set(conversationId: string, content: string, rules: string): Promise<WorkspaceMemory> }
  brain: {
    page(conversationId: string, offset?: number, limit?: number, query?: string, status?: BrainMemoryStatus): Promise<CollectionPage<BrainMemory>>
    create(conversationId: string, value: { kind: BrainMemoryKind; scope: BrainMemoryScope; content: string }): Promise<BrainMemory>
    update(conversationId: string, memoryId: string, value: Omit<UpdateBrainMemoryInput, 'conversationId'>): Promise<BrainMemory>
    delete(conversationId: string, memoryId: string): Promise<{ deleted: true }>
    extract(conversationId: string, content: string): Promise<{ memories: BrainMemory[]; content: string; warning?: string }>
  }
  artifacts: { list(conversationId: string): Promise<Artifact[]>; page(conversationId: string, offset?: number, limit?: number): Promise<CollectionPage<Artifact>>; delete(conversationId: string, artifactId: string): Promise<{ deleted: true }> }
  suggestions: { list(conversationId: string): Promise<Suggestion[]>; page(conversationId: string, offset?: number, limit?: number): Promise<CollectionPage<Suggestion>>; create(conversationId: string, content: string): Promise<{ suggestions: Suggestion[]; content: string }>; status(conversationId: string, suggestionId: string, status: SuggestionStatus, result?: string): Promise<Suggestion> }
  data: { export(): Promise<string | null>; import(): Promise<boolean> }
  diagnostics: { openLogs(): Promise<string>; copy(): Promise<string>; rendererError(value: { type: 'error' | 'unhandledRejection'; message: string; stack?: string }): Promise<void>; rendererStats(value: { responseSize: number; activities: number; messages: number }): Promise<void> }
  settings: { get(): Promise<CodexSettings>; check(): Promise<CodexSettings>; set(settings: Pick<CodexSettings, 'model' | 'sandbox' | 'approvalPolicy' | 'codexPath' | 'diagnosticMode' | 'theme' | 'defaultAgentMode'>): Promise<CodexSettings> }
  git: { status(conversationId: string): Promise<GitInfo>; commit(conversationId: string, message: string, files: string[]): Promise<{ output: string }> }
  documents: { saveMarkdown(conversationId: string, content: string, name?: string): Promise<string | null>; export(conversationId: string, content: string, format: 'docx' | 'pdf' | 'html'): Promise<string | null> }
  clipboard: { readText(): Promise<string>; writeText(value: string): Promise<void> }
}

declare global { interface Window { nocturne: NocturneApi } }
