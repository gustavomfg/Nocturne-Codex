import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import { CodexClient } from '../codex/CodexClient'
import { LocalDatabase, type ConversationRow } from '../database/Database'

const idSchema = z.string().uuid()
const execFileAsync = promisify(execFile)
const sendSchema = z.object({ conversationId: z.string().uuid(), prompt: z.string().trim().min(1).max(100_000), attachments: z.array(z.string()).max(10).default([]) })
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
    database.touchWorkspace(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('workspace:validate', (_event, value: unknown) => {
    const workspace = z.string().min(1).parse(value)
    const resolved = path.resolve(workspace)
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : null
  })
  ipcMain.handle('workspaces:list', () => database.listWorkspaces())
  ipcMain.handle('workspaces:remove', (_event, value: unknown) => database.removeWorkspace(z.string().min(1).parse(value)))

  ipcMain.handle('conversations:list', () => database.listConversations())
  ipcMain.handle('conversations:create', (_event, value: unknown) => database.createConversation(z.string().min(1).parse(value)))
  ipcMain.handle('conversations:messages', (_event, value: unknown) => database.listMessages(idSchema.parse(value)))
  ipcMain.handle('conversations:delete', (_event, value: unknown) => database.deleteConversation(idSchema.parse(value)))

  ipcMain.handle('files:attach', async (_event, value: unknown) => {
    const conversation = getConversation(database, idSchema.parse(value))
    const result = await dialog.showOpenDialog(win, {
      title: 'Anexar arquivos de texto', defaultPath: conversation.workspace, properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Arquivos de texto', extensions: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml', 'toml', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'sh'] }],
    })
    if (result.canceled) return []
    return result.filePaths.map((filePath) => {
      assertInsideWorkspace(filePath, conversation.workspace)
      const stat = fs.statSync(filePath)
      if (stat.size > 1_000_000) throw new Error(`${path.basename(filePath)} excede o limite de 1 MB.`)
      return { path: filePath, name: path.basename(filePath), size: stat.size }
    })
  })

  ipcMain.handle('files:open', async (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), filePath: z.string().min(1), action: z.enum(['file', 'folder', 'editor']) }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    assertInsideWorkspace(data.filePath, conversation.workspace)
    if (!fs.existsSync(data.filePath)) throw new Error('Arquivo não encontrado.')
    if (data.action === 'folder') { shell.showItemInFolder(data.filePath); return }
    const error = await shell.openPath(data.filePath)
    if (error) throw new Error(error)
  })

  ipcMain.handle('codex:start', async () => {
    await codex.start()
    return { status: codex.status }
  })

  ipcMain.handle('codex:send', async (_event, value: unknown) => {
    const { conversationId, prompt, attachments } = sendSchema.parse(value)
    const conversation = getConversation(database, conversationId)
    assertWorkspace(conversation)
    attachments.forEach((filePath) => assertInsideWorkspace(filePath, conversation.workspace))

    let threadId = conversation.codexThreadId
    let recreated = false
    if (!threadId) {
      threadId = await codex.createThread(conversation.workspace, database.getSettings())
      database.setThread(conversationId, threadId)
    } else {
      try { await codex.resumeThread(threadId, conversation.workspace, database.getSettings()) }
      catch {
        database.clearThread(conversationId)
        threadId = await codex.createThread(conversation.workspace, database.getSettings())
        database.setThread(conversationId, threadId)
        recreated = true
      }
    }
    database.addMessage(conversationId, 'user', prompt, { attachments })
    if (conversation.title === 'Nova conversa') database.renameFromPrompt(conversationId, prompt)
    await codex.sendTurn(threadId, conversation.workspace, prompt, database.getSettings(), attachments)
    return { threadId, recreated }
  })

  ipcMain.handle('codex:resume', async (_event, value: unknown) => {
    const conversation = getConversation(database, idSchema.parse(value))
    if (!conversation.codexThreadId) return { resumed: false }
    await codex.resumeThread(conversation.codexThreadId, conversation.workspace, database.getSettings())
    return { resumed: true }
  })

  ipcMain.handle('codex:interrupt', async (_event, value: unknown) => {
    const conversation = getConversation(database, idSchema.parse(value))
    if (!conversation.codexThreadId) throw new Error('Esta conversa ainda não possui uma thread do Codex.')
    await codex.interrupt(conversation.codexThreadId)
  })

  ipcMain.handle('codex:save-assistant', (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string(), metadata: z.unknown().optional() }).parse(value)
    return database.addMessage(data.conversationId, 'assistant', data.content, data.metadata)
  })

  ipcMain.handle('codex:approve', (_event, value: unknown) => {
    const data = approvalSchema.parse(value)
    return codex.resolveApproval(data.key, data.accepted, data.forSession)
  })

  ipcMain.handle('settings:get', async () => ({ ...database.getSettings(), ...(await getCodexInfo(codex)) }))
  ipcMain.handle('settings:set', (_event, value: unknown) => {
    const data = z.object({ model: z.string().max(100), sandbox: z.enum(['read-only', 'workspace-write']), approvalPolicy: z.enum(['untrusted', 'on-request', 'never']) }).parse(value)
    database.setSettings(data)
    return database.getSettings()
  })

  ipcMain.handle('git:status', async (_event, value: unknown) => gitStatus(getConversation(database, idSchema.parse(value)).workspace))
  ipcMain.handle('git:commit', async (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), message: z.string().trim().min(1).max(200) }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Preparar e criar commit'], defaultId: 0, cancelId: 0, title: 'Confirmar commit', message: `Criar commit no workspace ${path.basename(conversation.workspace)}?`, detail: `Todas as alterações atuais serão preparadas com git add -A.\n\n${data.message}` })
    if (confirmation.response !== 1) throw new Error('Commit cancelado pelo usuário.')
    await run('git', ['add', '-A'], conversation.workspace)
    const { stdout } = await run('git', ['commit', '-m', data.message], conversation.workspace)
    return { output: stdout.trim() }
  })

  ipcMain.handle('documents:saveMarkdown', async (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string(), name: z.string().default('documento.md') }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    const result = await dialog.showSaveDialog(win, { title: 'Salvar documento Markdown', defaultPath: path.join(conversation.workspace, safeName(data.name, '.md')), filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, data.content, 'utf8')
    return result.filePath
  })

  ipcMain.handle('documents:export', async (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string(), format: z.enum(['docx', 'pdf', 'html']) }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    const available = await commandVersion('pandoc')
    if (!available) throw new Error('Pandoc não foi encontrado no PATH.')
    const result = await dialog.showSaveDialog(win, { title: `Exportar ${data.format.toUpperCase()}`, defaultPath: path.join(conversation.workspace, `documento.${data.format}`), filters: [{ name: data.format.toUpperCase(), extensions: [data.format] }] })
    if (result.canceled || !result.filePath) return null
    await pipeCommand('pandoc', ['-f', 'markdown', '-t', data.format, '-o', result.filePath], data.content, conversation.workspace)
    return result.filePath
  })
}

function getConversation(database: LocalDatabase, id: string) {
  const conversation = database.listConversations().find((item) => item.id === id)
  if (!conversation) throw new Error('Conversa não encontrada.')
  return conversation
}

function assertWorkspace(conversation: ConversationRow) {
  const workspace = path.resolve(conversation.workspace)
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    throw new Error('O workspace desta conversa não está mais disponível.')
  }
}

function assertInsideWorkspace(filePath: string, workspace: string) {
  const relative = path.relative(path.resolve(workspace), path.resolve(filePath))
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('O arquivo precisa estar dentro do workspace selecionado.')
}

async function run(command: string, args: string[], cwd: string) {
  try { return await execFileAsync(command, args, { cwd, timeout: 20_000, maxBuffer: 5_000_000 }) }
  catch (error) { throw new Error(error instanceof Error ? error.message : String(error)) }
}

async function gitStatus(workspace: string) {
  const [branch, status, diff, staged] = await Promise.all([
    run('git', ['branch', '--show-current'], workspace), run('git', ['status', '--short'], workspace),
    run('git', ['diff', '--no-ext-diff'], workspace), run('git', ['diff', '--cached', '--no-ext-diff'], workspace),
  ])
  return { branch: branch.stdout.trim() || '(detached)', status: status.stdout, diff: [diff.stdout, staged.stdout].filter(Boolean).join('\n') }
}

async function getCodexInfo(codex: CodexClient) {
  const executable = findExecutable('codex')
  const version = await commandVersion(executable || 'codex')
  let config: unknown = null
  try { config = await codex.readConfig() } catch { /* status remains truthful through the Codex status event */ }
  return { codexPath: executable || 'codex', codexVersion: version || 'indisponível', pandocVersion: await commandVersion('pandoc') || 'indisponível', serverStatus: codex.status, rawConfig: config }
}

function findExecutable(name: string) {
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    const candidate = path.join(directory, name)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function commandVersion(command: string) {
  try { const { stdout, stderr } = await execFileAsync(command, ['--version'], { timeout: 5_000 }); return (stdout || stderr).trim() }
  catch { return null }
}

function safeName(name: string, extension: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '-')
  return base.endsWith(extension) ? base : `${base}${extension}`
}

function pipeCommand(command: string, args: string[], input: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'ignore', 'pipe'] })
    let error = ''
    child.stderr.on('data', (chunk) => { error += chunk.toString() })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(error || `Pandoc encerrou com código ${code}.`)))
    child.stdin.end(input)
  })
}
