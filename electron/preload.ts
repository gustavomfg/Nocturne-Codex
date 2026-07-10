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
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    create: (workspace: string) => ipcRenderer.invoke('conversations:create', workspace),
    messages: (id: string) => ipcRenderer.invoke('conversations:messages', id),
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  },
  codex: {
    start: () => ipcRenderer.invoke('codex:start'),
    send: (conversationId: string, prompt: string) => ipcRenderer.invoke('codex:send', { conversationId, prompt }),
    saveAssistant: (conversationId: string, content: string, metadata?: unknown) => ipcRenderer.invoke('codex:save-assistant', { conversationId, content, metadata }),
    approve: (key: string, accepted: boolean, forSession = false) => ipcRenderer.invoke('codex:approve', { key, accepted, forSession }),
    onEvent: (listener: (payload: unknown) => void) => on('codex:event', listener),
    onStatus: (listener: (payload: unknown) => void) => on('codex:status', listener),
  },
})

