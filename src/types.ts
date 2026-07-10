export type Role = 'user' | 'assistant' | 'system'
export interface Conversation { id: string; title: string; workspace: string; codexThreadId: string | null; createdAt: string; updatedAt: string }
export interface Workspace { path: string; name: string; favorite: boolean; createdAt: string; lastOpenedAt: string }
export interface Message { id: string; conversationId: string; role: Role; content: string; metadata: string | null; createdAt: string }
export interface Approval { key: string; kind: 'command' | 'file'; title: string; detail: string; status: 'pending' | 'accepted' | 'declined' }
export interface Activity { id: string; type: 'command' | 'file' | 'reasoning' | 'read' | 'error' | 'completion'; label: string; detail?: string; status: 'running' | 'completed' | 'failed' }
export interface ChangedFile { path: string; kind: 'created' | 'modified' | 'deleted'; status: string }
export interface Attachment { path: string; name: string; size: number }
export interface Artifact { id: string; conversationId: string; workspace: string; type: 'code' | 'markdown' | 'document' | 'image' | 'configuration' | 'report' | 'response' | 'file' | 'diff'; title: string; filePath: string | null; content: string | null; metadata: string | null; createdAt: string; updatedAt: string }
export interface FilePreview { kind: 'text' | 'markdown' | 'image'; name: string; filePath: string; mime: string; content: string; size: number }
export interface ProjectContext { name: string; stack: string[]; primaryLanguage: string; commands: Record<string, string> }
export interface WorkspaceMemory { content: string; rules: string; project?: ProjectContext; updatedAt: string }
export interface PlanStep { step: string; status: 'pending' | 'inProgress' | 'completed' }
export interface GitInfo { branch: string; status: string; diff: string }
export interface CodexSettings { model: string; sandbox: 'read-only' | 'workspace-write'; approvalPolicy: 'untrusted' | 'on-request' | 'never'; codexPath?: string; codexVersion?: string; pandocVersion?: string; serverStatus?: CodexStatus; diagnosticMode?: boolean }
export interface CodexDiagnostics { executable: string; version?: string; pid: number | null; state: CodexStatus; lastFailure: string | null; logsPath: string }
export interface CodexEvent { method: string; params: Record<string, unknown> }
export type CodexStatus = AgentState

declare global {
  interface Window {
    nocturne: {
      workspace: { select(): Promise<string | null>; validate(value: string): Promise<string | null>; list(): Promise<Workspace[]>; remove(value: string): Promise<void>; favorite(value: string, favorite: boolean): Promise<void>; openTool(value: string, tool: 'editor' | 'terminal'): Promise<void> }
      conversations: { list(): Promise<Conversation[]>; create(workspace: string): Promise<Conversation>; messages(id: string): Promise<Message[]>; delete(id: string): Promise<void> }
      codex: {
        start(): Promise<{ status: CodexStatus }>
        restart(): Promise<CodexDiagnostics>
        diagnostics(): Promise<CodexDiagnostics>
        send(conversationId: string, prompt: string, attachments?: string[]): Promise<{ threadId: string; recreated: boolean }>
        resume(conversationId: string): Promise<{ resumed: boolean }>
        interrupt(conversationId: string): Promise<void>
        saveAssistant(conversationId: string, content: string, metadata?: unknown): Promise<Message>
        approve(key: string, accepted: boolean, forSession?: boolean): Promise<void>
        onEvent(listener: (event: CodexEvent) => void): () => void
        onStatus(listener: (status: { status: CodexStatus; error?: string }) => void): () => void
      }
      files: { attach(conversationId: string): Promise<Attachment[]>; open(conversationId: string, filePath: string, action: 'file' | 'folder' | 'editor'): Promise<void>; preview(conversationId: string, filePath: string): Promise<FilePreview> }
      memory: { get(conversationId: string): Promise<WorkspaceMemory>; set(conversationId: string, content: string, rules: string): Promise<WorkspaceMemory> }
      artifacts: { list(conversationId: string): Promise<Artifact[]>; delete(conversationId: string, artifactId: string): Promise<void> }
      data: { export(): Promise<string | null>; import(): Promise<boolean> }
      diagnostics: { openLogs(): Promise<string>; copy(): Promise<string>; rendererError(value: { type: 'error' | 'unhandledRejection'; message: string; stack?: string }): Promise<void>; rendererStats(value: { responseSize: number; activities: number; messages: number }): Promise<void> }
      settings: { get(): Promise<CodexSettings>; set(settings: Pick<CodexSettings, 'model' | 'sandbox' | 'approvalPolicy' | 'codexPath' | 'diagnosticMode'>): Promise<CodexSettings> }
      git: { status(conversationId: string): Promise<GitInfo>; commit(conversationId: string, message: string): Promise<{ output: string }> }
      documents: { saveMarkdown(conversationId: string, content: string, name?: string): Promise<string | null>; export(conversationId: string, content: string, format: 'docx' | 'pdf' | 'html'): Promise<string | null> }
    }
  }
}
import type { AgentState } from '../shared/agentState'
