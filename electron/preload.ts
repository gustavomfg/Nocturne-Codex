import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS as channels } from '../shared/ipc/channels'

const on = (channel: string, listener: (payload: unknown) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

export const nocturneApi = {
  workspace: {
    select: () => ipcRenderer.invoke(channels.workspace.select),
    validate: (workspace: string) => ipcRenderer.invoke(channels.workspace.validate, workspace),
    list: () => ipcRenderer.invoke(channels.workspace.list),
    remove: (workspace: string) => ipcRenderer.invoke(channels.workspace.remove, workspace),
    favorite: (workspace: string, favorite: boolean) => ipcRenderer.invoke(channels.workspace.favorite, { workspace, favorite }),
    openTool: (workspace: string, tool: 'editor' | 'terminal') => ipcRenderer.invoke(channels.workspace.openTool, { workspace, tool }),
  },
  conversations: {
    list: () => ipcRenderer.invoke(channels.conversations.list),
    create: (workspace: string) => ipcRenderer.invoke(channels.conversations.create, workspace),
    messages: (id: string) => ipcRenderer.invoke(channels.conversations.messages, id),
    delete: (id: string) => ipcRenderer.invoke(channels.conversations.delete, id),
  },
  codex: {
    start: () => ipcRenderer.invoke(channels.codex.start),
    restart: () => ipcRenderer.invoke(channels.codex.restart),
    diagnostics: () => ipcRenderer.invoke(channels.codex.diagnostics),
    send: (conversationId: string, prompt: string, attachments: string[] = [], mode = 'build') => ipcRenderer.invoke(channels.codex.send, { conversationId, prompt, attachments, mode }),
    resume: (conversationId: string) => ipcRenderer.invoke(channels.codex.resume, conversationId),
    interrupt: (conversationId: string) => ipcRenderer.invoke(channels.codex.interrupt, conversationId),
    saveAssistant: (conversationId: string, content: string, metadata?: unknown) => ipcRenderer.invoke(channels.codex.saveAssistant, { conversationId, content, metadata }),
    approve: (key: string, accepted: boolean, forSession = false) => ipcRenderer.invoke(channels.codex.approve, { key, accepted, forSession }),
    onEvent: (listener: (payload: unknown) => void) => on(channels.codex.event, listener),
    onStatus: (listener: (payload: unknown) => void) => on(channels.codex.status, listener),
  },
  files: {
    attach: (conversationId: string) => ipcRenderer.invoke(channels.files.attach, conversationId),
    open: (conversationId: string, filePath: string, action: 'file' | 'folder' | 'editor') => ipcRenderer.invoke(channels.files.open, { conversationId, filePath, action }),
    preview: (conversationId: string, filePath: string) => ipcRenderer.invoke(channels.files.preview, { conversationId, filePath }),
  },
  memory: { get: (conversationId: string) => ipcRenderer.invoke(channels.memory.get, conversationId), set: (conversationId: string, content: string, rules: string) => ipcRenderer.invoke(channels.memory.set, { conversationId, content, rules }) },
  artifacts: { list: (conversationId: string) => ipcRenderer.invoke(channels.artifacts.list, conversationId), delete: (conversationId: string, artifactId: string) => ipcRenderer.invoke(channels.artifacts.delete, { conversationId, artifactId }) },
  suggestions: { list: (conversationId: string) => ipcRenderer.invoke(channels.suggestions.list, conversationId), create: (conversationId: string, content: string) => ipcRenderer.invoke(channels.suggestions.create, { conversationId, content }), status: (conversationId: string, suggestionId: string, status: string, result?: string) => ipcRenderer.invoke(channels.suggestions.status, { conversationId, suggestionId, status, result }) },
  data: { export: () => ipcRenderer.invoke(channels.data.export), import: () => ipcRenderer.invoke(channels.data.import) },
  diagnostics: { openLogs: () => ipcRenderer.invoke(channels.diagnostics.openLogs), copy: () => ipcRenderer.invoke(channels.diagnostics.copy), rendererError: (value: unknown) => ipcRenderer.invoke(channels.diagnostics.rendererError, value), rendererStats: (value: unknown) => ipcRenderer.invoke(channels.diagnostics.rendererStats, value) },
  settings: { get: () => ipcRenderer.invoke(channels.settings.get), set: (settings: unknown) => ipcRenderer.invoke(channels.settings.set, settings) },
  git: { status: (conversationId: string) => ipcRenderer.invoke(channels.git.status, conversationId), commit: (conversationId: string, message: string) => ipcRenderer.invoke(channels.git.commit, { conversationId, message }) },
  documents: {
    saveMarkdown: (conversationId: string, content: string, name?: string) => ipcRenderer.invoke(channels.documents.saveMarkdown, { conversationId, content, name }),
    export: (conversationId: string, content: string, format: 'docx' | 'pdf' | 'html') => ipcRenderer.invoke(channels.documents.export, { conversationId, content, format }),
  },
}

contextBridge.exposeInMainWorld('nocturne', nocturneApi)
