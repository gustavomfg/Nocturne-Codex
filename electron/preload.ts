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
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    create: (workspace: string) => ipcRenderer.invoke('conversations:create', workspace),
    messages: (id: string) => ipcRenderer.invoke('conversations:messages', id),
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  },
  codex: {
    start: () => ipcRenderer.invoke('codex:start'),
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
  },
  settings: { get: () => ipcRenderer.invoke('settings:get'), set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings) },
  git: { status: (conversationId: string) => ipcRenderer.invoke('git:status', conversationId), commit: (conversationId: string, message: string) => ipcRenderer.invoke('git:commit', { conversationId, message }) },
  documents: {
    saveMarkdown: (conversationId: string, content: string, name?: string) => ipcRenderer.invoke('documents:saveMarkdown', { conversationId, content, name }),
    export: (conversationId: string, content: string, format: 'docx' | 'pdf' | 'html') => ipcRenderer.invoke('documents:export', { conversationId, content, format }),
  },
})
