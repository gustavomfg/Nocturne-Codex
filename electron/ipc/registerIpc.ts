import { BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'
import { CodexClient } from '../codex/CodexClient'
import { LocalDatabase, type ConversationRow } from '../database/Database'

const idSchema = z.string().uuid()
const sendSchema = z.object({ conversationId: z.string().uuid(), prompt: z.string().trim().min(1).max(100_000) })
const approvalSchema = z.object({ key: z.string().min(1), accepted: z.boolean(), forSession: z.boolean().optional() })

export function registerIpc(win: BrowserWindow, database: LocalDatabase, codex: CodexClient) {
  const push = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  codex.on('event', (event) => push('codex:event', event))
  codex.on('status', (status) => push('codex:status', status))

  ipcMain.handle('workspace:select', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Selecionar workspace' })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('workspace:validate', (_event, value: unknown) => {
    const workspace = z.string().min(1).parse(value)
    const resolved = path.resolve(workspace)
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : null
  })

  ipcMain.handle('conversations:list', () => database.listConversations())
  ipcMain.handle('conversations:create', (_event, value: unknown) => database.createConversation(z.string().min(1).parse(value)))
  ipcMain.handle('conversations:messages', (_event, value: unknown) => database.listMessages(idSchema.parse(value)))
  ipcMain.handle('conversations:delete', (_event, value: unknown) => database.deleteConversation(idSchema.parse(value)))

  ipcMain.handle('codex:start', async () => {
    await codex.start()
    return { status: codex.status }
  })

  ipcMain.handle('codex:send', async (_event, value: unknown) => {
    const { conversationId, prompt } = sendSchema.parse(value)
    const conversation = database.listConversations().find((item) => item.id === conversationId)
    if (!conversation) throw new Error('Conversa não encontrada.')
    assertWorkspace(conversation)

    database.addMessage(conversationId, 'user', prompt)
    if (conversation.title === 'Nova conversa') database.renameFromPrompt(conversationId, prompt)
    let threadId = conversation.codexThreadId
    if (!threadId) {
      threadId = await codex.createThread(conversation.workspace)
      database.setThread(conversationId, threadId)
    }
    await codex.sendTurn(threadId, conversation.workspace, prompt)
    return { threadId }
  })

  ipcMain.handle('codex:save-assistant', (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string(), metadata: z.unknown().optional() }).parse(value)
    return database.addMessage(data.conversationId, 'assistant', data.content, data.metadata)
  })

  ipcMain.handle('codex:approve', (_event, value: unknown) => {
    const data = approvalSchema.parse(value)
    return codex.resolveApproval(data.key, data.accepted, data.forSession)
  })
}

function assertWorkspace(conversation: ConversationRow) {
  const workspace = path.resolve(conversation.workspace)
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    throw new Error('O workspace desta conversa não está mais disponível.')
  }
}

