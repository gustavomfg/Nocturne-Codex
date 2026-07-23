export type { AgentMode, Suggestion, SuggestionStatus } from './suggestions'

export type Role = 'user' | 'assistant' | 'system'
export interface Conversation { id: string; title: string; workspace: string; createdAt: string; updatedAt: string }
export interface Workspace { path: string; name: string; favorite: boolean; authorized: boolean; createdAt: string; lastOpenedAt: string }
export interface Message { id: string; conversationId: string; role: Role; content: string; metadata: string | null; createdAt: string }
export interface CollectionPage<T> { items: T[]; hasMore: boolean }
export interface MessagePage { items: Message[]; hasMore: boolean }
export interface Approval { key: string; kind: 'command' | 'file'; title: string; detail: string; status: 'pending' | 'accepted' | 'declined' }
export interface Activity { id: string; type: 'command' | 'file' | 'reasoning' | 'read' | 'error' | 'completion'; label: string; detail?: string; status: 'running' | 'completed' | 'failed' }
export interface ChangedFile { path: string; kind: 'created' | 'modified' | 'deleted'; status: string }
export interface Attachment { path: string; name: string; size: number }
export interface Artifact { id: string; conversationId: string; workspace: string; type: 'code' | 'markdown' | 'document' | 'image' | 'configuration' | 'report' | 'response' | 'file' | 'diff'; title: string; filePath: string | null; content: string | null; metadata: string | null; createdAt: string; updatedAt: string }
export interface FilePreview { kind: 'text' | 'markdown' | 'image'; name: string; filePath: string; mime: string; content: string; size: number }
export interface ProjectContext { name: string; stack: string[]; primaryLanguage: string; commands: Record<string, string> }
export interface WorkspaceMemory { content: string; rules: string; project?: ProjectContext; updatedAt: string }
export interface PlanStep { step: string; status: 'pending' | 'inProgress' | 'completed' }
export interface GitChangedFile { path: string; status: string; originalPath?: string }
export interface GitInfo { branch: string; status: string; diff: string; diffTruncated?: boolean; filesTruncated?: boolean; files: GitChangedFile[] }
export interface AppSettings { model: string; sandbox: 'read-only' | 'workspace-write'; approvalPolicy: 'untrusted' | 'on-request'; diagnosticMode?: boolean; theme?: 'dark'; pandocVersion?: string }
export interface AgentEvent { method: string; params: Record<string, unknown> }
