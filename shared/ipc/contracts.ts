import type { AgentMode, Artifact, Attachment, AgentEvent, AppSettings, CollectionPage, Conversation, FilePreview, GitInfo, Message, MessagePage, Suggestion, SuggestionStatus, Workspace, WorkspaceMemory } from '../types'
import type { BrainMemory, BrainMemoryKind, BrainMemoryScope, BrainMemoryStatus, UpdateBrainMemoryInput } from '../brainMemory'
import type { ProviderAvailability } from '../ai/provider'
import type {
  ProviderConfigurationErrorCode,
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../ai/providerConfiguration'
import type { ModelDescriptor } from '../ai/model'
import type { WorkspaceModelBindings } from '../ai/bindings'

export interface ProviderConfigurationIpcError {
  code: ProviderConfigurationErrorCode
  message: string
  availability?: ProviderAvailability
}

export type ProviderConfigurationIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProviderConfigurationIpcError }

export type ModelIpcErrorCode =
  | 'invalid-request'
  | 'not-found'
  | 'workspace-not-authorized'
  | 'operation-failed'

export type ModelIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ModelIpcErrorCode; message: string } }

export interface NocturneApi {
  workspace: { select(expectedWorkspace?: string): Promise<string | null>; validate(value: string): Promise<string | null>; list(): Promise<Workspace[]>; remove(value: string): Promise<void>; favorite(value: string, favorite: boolean): Promise<void>; openTool(value: string, tool: 'editor' | 'terminal'): Promise<void> }
  conversations: { list(): Promise<Conversation[]>; page(offset?: number, limit?: number): Promise<CollectionPage<Conversation>>; create(workspace: string): Promise<Conversation>; messages(id: string): Promise<Message[]>; messagePage(id: string, offset?: number, limit?: number): Promise<MessagePage>; delete(id: string): Promise<void> }
  ai: { send(conversationId: string, prompt: string, attachments?: string[], mode?: AgentMode): Promise<void>; saveAssistant(conversationId: string, content: string, metadata?: unknown): Promise<Message>; approve(key: string, accepted: boolean, forSession?: boolean): Promise<void>; onEvent(listener: (event: AgentEvent) => void): () => void; onStatus(listener: (status: { status: string; error?: string }) => void): () => void }
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
  settings: { get(): Promise<AppSettings>; set(settings: Partial<AppSettings>): Promise<AppSettings> }
  providers: {
    list(): Promise<ProviderConfigurationSummary[]>
    create(configuration: ProviderConfigurationInput, credential?: string): Promise<ProviderConfigurationSummary>
    update(id: string, configuration: ProviderConfigurationInput, options?: { credential?: string; clearCredential?: boolean }): Promise<ProviderConfigurationSummary>
    remove(id: string): Promise<boolean>
    testConnection(id: string): Promise<ProviderAvailability>
  }
  models: {
    list(): Promise<ModelDescriptor[]>
    refresh(providerId: string): Promise<{ status: 'applied' | 'superseded'; models: ModelDescriptor[] }>
    bindings(workspaceId: string): Promise<WorkspaceModelBindings | null>
    setBindings(bindings: WorkspaceModelBindings): Promise<WorkspaceModelBindings>
  }
  git: { status(conversationId: string): Promise<GitInfo>; commit(conversationId: string, message: string, files: string[]): Promise<{ output: string }> }
  documents: { saveMarkdown(conversationId: string, content: string, name?: string): Promise<string | null>; export(conversationId: string, content: string, format: 'docx' | 'pdf' | 'html'): Promise<string | null> }
  clipboard: { readText(): Promise<string>; writeText(value: string): Promise<void> }
}

declare global { interface Window { nocturne: NocturneApi } }
