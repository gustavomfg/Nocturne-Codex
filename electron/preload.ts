import { contextBridge, ipcRenderer } from 'electron'

const on = (channel: string, listener: (payload: unknown) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('nocturne', {
  workspace: {
    select: () => ipcRenderer.invoke('workspace:select'),
    validate: (workspace: string) => ipcRenderer.invoke('workspace:validate', workspace),
    list: () => ipcRenderer.invoke('workspaces:list'),
    remove: (workspace: string) => ipcRenderer.invoke('workspaces:remove', workspace),
    favorite: (workspace: string, favorite: boolean) => ipcRenderer.invoke('workspaces:favorite', { workspace, favorite }),
    openTool: (workspace: string, tool: 'editor' | 'terminal') => ipcRenderer.invoke('workspace:openTool', { workspace, tool }),
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    create: (workspace: string) => ipcRenderer.invoke('conversations:create', workspace),
    messages: (id: string) => ipcRenderer.invoke('conversations:messages', id),
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  },
  codex: {
    start: () => ipcRenderer.invoke('codex:start'),
    restart: () => ipcRenderer.invoke('codex:restart'),
    diagnostics: () => ipcRenderer.invoke('codex:diagnostics'),
    send: (conversationId: string, prompt: string, attachments: string[] = []) => ipcRenderer.invoke('codex:send', { conversationId, prompt, attachments }),
    resume: (conversationId: string) => ipcRenderer.invoke('codex:resume', conversationId),
    interrupt: (conversationId: string) => ipcRenderer.invoke('codex:interrupt', conversationId),
    saveAssistant: (conversationId: string, content: string, metadata?: unknown) => ipcRenderer.invoke('codex:save-assistant', { conversationId, content, metadata }),
    approve: (key: string, accepted: boolean, forSession = false) => ipcRenderer.invoke('codex:approve', { key, accepted, forSession }),
    onEvent: (listener: (payload: unknown) => void) => on('codex:event', listener),
    onStatus: (listener: (payload: unknown) => void) => on('codex:status', listener),
  },
  files: {
    attach: (conversationId: string) => ipcRenderer.invoke('files:attach', conversationId),
    open: (conversationId: string, filePath: string, action: 'file' | 'folder' | 'editor') => ipcRenderer.invoke('files:open', { conversationId, filePath, action }),
    preview: (conversationId: string, filePath: string) => ipcRenderer.invoke('files:preview', { conversationId, filePath }),
  },
  memory: { get: (conversationId: string) => ipcRenderer.invoke('memory:get', conversationId), set: (conversationId: string, content: string, rules: string) => ipcRenderer.invoke('memory:set', { conversationId, content, rules }) },
  artifacts: { list: (conversationId: string) => ipcRenderer.invoke('artifacts:list', conversationId), delete: (conversationId: string, artifactId: string) => ipcRenderer.invoke('artifacts:delete', { conversationId, artifactId }) },
  data: { export: () => ipcRenderer.invoke('data:export'), import: () => ipcRenderer.invoke('data:import') },
  diagnostics: { openLogs: () => ipcRenderer.invoke('diagnostics:openLogs'), copy: () => ipcRenderer.invoke('diagnostics:copy') },
  settings: { get: () => ipcRenderer.invoke('settings:get'), set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings) },
  git: { status: (conversationId: string) => ipcRenderer.invoke('git:status', conversationId), commit: (conversationId: string, message: string) => ipcRenderer.invoke('git:commit', { conversationId, message }) },
  documents: {
    saveMarkdown: (conversationId: string, content: string, name?: string) => ipcRenderer.invoke('documents:saveMarkdown', { conversationId, content, name }),
    export: (conversationId: string, content: string, format: 'docx' | 'pdf' | 'html') => ipcRenderer.invoke('documents:export', { conversationId, content, format }),
  },
})
