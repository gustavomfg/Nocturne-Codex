import { BrowserWindow, dialog, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import { CodexClient } from '../codex/CodexClient'
import { LocalDatabase, type ConversationRow } from '../database/Database'
import { Logger } from '../logging/Logger'
import { resolveInsideWorkspace } from '../security/ExecutionPolicy'
import { agentModes, extractSuggestions } from '../../shared/suggestions'
import { approvalSchema, codexSendSchema, fileActionSchema, filePreviewSchema, idSchema, suggestionStatusSchema, workspaceFavoriteSchema, workspaceToolSchema } from '../../shared/ipc/schemas'
import { CODEX_COMPATIBILITY } from '../../shared/constants'
import { registerDataIpc } from './registerDataIpc'
import { registerGitIpc } from './registerGitIpc'
import { registerCodexBridge } from './registerCodexBridge'
import { safeIpcMain } from './safeIpc'

const execFileAsync = promisify(execFile)

export function registerIpc(win: BrowserWindow, database: LocalDatabase, codex: CodexClient, logger: Logger) {
  const ipcMain = safeIpcMain(win)
  registerDataIpc(win, database, logger)
  registerGitIpc(win, database)
  const approvalDetails = new Map<string, { command?: string; risk?: string }>()
  registerCodexBridge(win, codex, logger, approvalDetails)

  ipcMain.handle('workspace:select', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Selecionar workspace' })
    if (result.canceled || !result.filePaths[0]) return null
    database.touchWorkspace(result.filePaths[0])
    ensureNocturneWorkspace(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('workspace:validate', (_event, value: unknown) => {
    const workspace = z.string().min(1).parse(value)
    const resolved = path.resolve(workspace)
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : null
  })
  ipcMain.handle('workspaces:list', () => database.listWorkspaces())
  ipcMain.handle('workspaces:remove', (_event, value: unknown) => database.removeWorkspace(z.string().min(1).parse(value)))
  ipcMain.handle('workspaces:favorite', (_event, value: unknown) => {
    const data = workspaceFavoriteSchema.parse(value)
    assertKnownWorkspace(database, data.workspace)
    database.setWorkspaceFavorite(data.workspace, data.favorite)
  })
  ipcMain.handle('workspace:openTool', async (_event, value: unknown) => {
    const data = workspaceToolSchema.parse(value)
    const workspace = assertKnownWorkspace(database, data.workspace)
    if (!fs.existsSync(workspace)) throw new Error('Workspace não encontrado.')
    if (data.tool === 'editor') {
      try { await run('code', [workspace], workspace) } catch { throw new Error('Não foi possível abrir o VS Code. Verifique se o comando “code” está no PATH.') }
      return
    }
    const terminal = process.platform === 'win32' ? ['cmd', ['/K', 'cd', '/d', workspace]] as const
      : process.platform === 'darwin' ? ['open', ['-a', 'Terminal', workspace]] as const
      : ['x-terminal-emulator', ['--working-directory', workspace]] as const
    const child = spawn(terminal[0], [...terminal[1]], { cwd: workspace, detached: true, stdio: 'ignore' })
    child.unref()
  })

  ipcMain.handle('conversations:list', () => database.listConversations())
  ipcMain.handle('conversations:create', (_event, value: unknown) => {
    const workspace = assertKnownWorkspace(database, z.string().min(1).parse(value))
    ensureNocturneWorkspace(workspace)
    return database.createConversation(workspace)
  })
  ipcMain.handle('conversations:messages', (_event, value: unknown) => database.listMessages(idSchema.parse(value)))
  ipcMain.handle('conversations:delete', (_event, value: unknown) => database.deleteConversation(idSchema.parse(value)))

  ipcMain.handle('files:attach', async (_event, value: unknown) => {
    const conversation = getConversation(database, idSchema.parse(value))
    const result = await dialog.showOpenDialog(win, {
      title: 'Anexar arquivos de texto', defaultPath: conversation.workspace, properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Arquivos do projeto', extensions: ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml', 'toml', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'sh', 'sql', 'env', 'ini'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
    })
    if (result.canceled) return []
    return result.filePaths.map((filePath) => {
      assertInsideWorkspace(filePath, conversation.workspace)
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) throw new Error(`${path.basename(filePath)} não é um arquivo válido.`)
      if (stat.size > 1_000_000) throw new Error(`${path.basename(filePath)} excede o limite de 1 MB.`)
      return { path: filePath, name: path.basename(filePath), size: stat.size }
    })
  })

  ipcMain.handle('files:open', async (_event, value: unknown) => {
    const data = fileActionSchema.parse(value)
    const conversation = getConversation(database, data.conversationId)
    const filePath = resolveWorkspaceFile(data.filePath, conversation.workspace)
    if (!fs.existsSync(filePath)) throw new Error('Arquivo não encontrado.')
    if (data.action === 'folder') { shell.showItemInFolder(filePath); return }
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })

  ipcMain.handle('files:preview', (_event, value: unknown) => {
    const data = filePreviewSchema.parse(value)
    const conversation = getConversation(database, data.conversationId)
    const filePath = resolveWorkspaceFile(data.filePath, conversation.workspace)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error('Arquivo não encontrado.')
    const stat = fs.statSync(filePath)
    if (stat.size > 2_000_000) throw new Error('Preview limitado a arquivos de até 2 MB.')
    const extension = path.extname(filePath).toLowerCase()
    const imageMime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' } as Record<string, string>)[extension]
    if (imageMime) return { kind: 'image', name: path.basename(filePath), filePath, mime: imageMime, content: `data:${imageMime};base64,${fs.readFileSync(filePath).toString('base64')}`, size: stat.size }
    if (!isTextFile(extension)) throw new Error('Este formato não possui preview interno.')
    return { kind: extension === '.md' ? 'markdown' : 'text', name: path.basename(filePath), filePath, mime: 'text/plain', content: fs.readFileSync(filePath, 'utf8'), size: stat.size }
  })

  ipcMain.handle('memory:get', (_event, value: unknown) => {
    const workspace = getConversation(database, idSchema.parse(value)).workspace
    const files = readWorkspaceContext(workspace)
    const persisted = database.getWorkspaceMemory(workspace)
    if (persisted.content && Date.parse(persisted.updatedAt) > Date.parse(files.updatedAt)) {
      const marker = '\n\n# Regras do projeto\n'
      const markerAt = persisted.content.indexOf(marker)
      const content = markerAt >= 0 ? persisted.content.slice(0, markerAt) : persisted.content
      const rules = markerAt >= 0 ? persisted.content.slice(markerAt + marker.length) : files.rules
      return writeWorkspaceContext(workspace, content, rules)
    }
    return files
  })
  ipcMain.handle('memory:set', (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string().max(20_000), rules: z.string().max(20_000).default('') }).parse(value)
    const workspace = getConversation(database, data.conversationId).workspace
    const result = writeWorkspaceContext(workspace, data.content, data.rules)
    database.setWorkspaceMemory(workspace, `${data.content}\n\n# Regras do projeto\n${data.rules}`)
    return result
  })

  ipcMain.handle('artifacts:list', (_event, value: unknown) => database.listArtifacts(idSchema.parse(value)))
  ipcMain.handle('artifacts:delete', (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), artifactId: z.string().uuid() }).parse(value)
    if (!database.listArtifacts(data.conversationId).some((artifact) => artifact.id === data.artifactId)) throw new Error('Artefato não encontrado.')
    database.deleteArtifact(data.artifactId)
  })
  ipcMain.handle('codex:start', async () => {
    await codex.start(database.getSettings().codexPath || 'codex')
    return { status: codex.status }
  })
  ipcMain.handle('codex:restart', async () => {
    await codex.restart(database.getSettings().codexPath || 'codex')
    return codex.getDiagnostics()
  })
  ipcMain.handle('codex:diagnostics', () => ({ ...codex.getDiagnostics(), version: database.getSettings().codexVersion || undefined, logsPath: logger.path }))
  ipcMain.handle('diagnostics:openLogs', () => shell.openPath(logger.path))
  ipcMain.handle('diagnostics:copy', async () => JSON.stringify({ app: 'Nocturne Codex', platform: process.platform, arch: process.arch, codex: codex.getDiagnostics() }, null, 2))
  ipcMain.handle('diagnostics:rendererError', (_event, value: unknown) => {
    const data = z.object({ type: z.enum(['error', 'unhandledRejection']), message: z.string().max(8_000), stack: z.string().max(20_000).optional() }).parse(value)
    logger.error('app', `Renderer ${data.type}`, data)
  })
  ipcMain.handle('diagnostics:rendererStats', (_event, value: unknown) => {
    const data = z.object({ responseSize: z.number().int().nonnegative(), activities: z.number().int().nonnegative(), messages: z.number().int().nonnegative() }).parse(value)
    logger.info('app', 'Estado do renderer durante execução', data)
  })

  ipcMain.handle('codex:send', async (_event, value: unknown) => {
    const { conversationId, prompt, attachments, mode } = codexSendSchema.parse(value)
    const conversation = getConversation(database, conversationId)
    assertWorkspace(conversation)
    attachments.forEach((filePath) => assertInsideWorkspace(filePath, conversation.workspace))

    let threadId = conversation.codexThreadId
    let recreated = false
    const context = readWorkspaceContext(conversation.workspace)
    const memory = `${context.content}\n\n# Regras do projeto\n${context.rules}\n\n# Projeto detectado\n${JSON.stringify(context.project, null, 2)}`
    if (!threadId) {
      threadId = await codex.createThread(conversation.workspace, database.getSettings(), memory)
      database.setThread(conversationId, threadId)
    } else {
      try { await codex.resumeThread(threadId, conversation.workspace, database.getSettings()) }
      catch {
        database.clearThread(conversationId)
        threadId = await codex.createThread(conversation.workspace, database.getSettings(), memory)
        database.setThread(conversationId, threadId)
        recreated = true
      }
    }
    database.addMessage(conversationId, 'user', prompt, { attachments })
    if (conversation.title === 'Nova conversa') database.renameFromPrompt(conversationId, prompt)
    await codex.sendTurn(threadId, conversation.workspace, prompt, database.getSettings(), attachments, memory, mode)
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
    const conversation = getConversation(database, data.conversationId)
    const message = database.addMessage(data.conversationId, 'assistant', data.content, data.metadata)
    database.addArtifact(data.conversationId, conversation.workspace, 'markdown', `Resposta · ${new Date().toLocaleString()}`, null, data.content, { origin: 'Codex' })
    const metadata = data.metadata as { files?: Array<{ path?: string; kind?: string }>; diff?: string } | undefined
    for (const file of metadata?.files ?? []) {
      if (!file.path) continue
      database.addArtifact(data.conversationId, conversation.workspace, artifactType(file.path), path.basename(file.path), file.path, null, { kind: file.kind, origin: 'Codex' })
    }
    if (metadata?.diff) database.addArtifact(data.conversationId, conversation.workspace, 'report', 'Alterações do turno', null, metadata.diff, { origin: 'Codex', format: 'diff' })
    return message
  })

  ipcMain.handle('suggestions:list', (_event, value: unknown) => database.listSuggestions(idSchema.parse(value)))
  ipcMain.handle('suggestions:create', (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string().max(2_000_000) }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    const extracted = extractSuggestions(data.content)
    const suggestions = extracted.suggestions.map((suggestion) => database.addSuggestion(data.conversationId, conversation.workspace, suggestion))
    if (suggestions.length) logger.info('artifacts', 'Sugestões de review persistidas', { conversationId: data.conversationId, count: suggestions.length })
    return { suggestions, content: extracted.content }
  })
  ipcMain.handle('suggestions:status', (_event, value: unknown) => {
    const data = suggestionStatusSchema.parse(value)
    const suggestion = database.listSuggestions(data.conversationId).find((item) => item.id === data.suggestionId)
    if (!suggestion) throw new Error('Sugestão não pertence a esta conversa.')
    const updated = database.setSuggestionStatus(data.suggestionId, data.status, data.result)
    recordSuggestionDecision(suggestion.workspaceId, updated)
    return updated
  })

  ipcMain.handle('codex:approve', (_event, value: unknown) => {
    const data = approvalSchema.parse(value)
    const detail = approvalDetails.get(data.key)
    database.recordApproval(data.key, data.accepted, detail?.command, detail?.risk)
    approvalDetails.delete(data.key)
    logger.info('codex', data.accepted ? 'Aprovação concedida' : 'Aprovação recusada', { approvalKey: data.key, risk: detail?.risk })
    return codex.resolveApproval(data.key, data.accepted, data.forSession)
  })

  ipcMain.handle('settings:get', async () => { const saved = database.getSettings(); return { ...saved, diagnosticMode: saved.diagnosticMode === 'true', ...(await getCodexInfo(codex)) } })
  ipcMain.handle('settings:set', (_event, value: unknown) => {
    const data = z.object({ model: z.string().max(100), sandbox: z.enum(['read-only', 'workspace-write']), approvalPolicy: z.enum(['untrusted', 'on-request']), codexPath: z.string().trim().max(1_000).optional(), diagnosticMode: z.boolean().optional(), theme: z.literal('dark').default('dark'), defaultAgentMode: z.enum(agentModes).default('review') }).parse(value)
    if (data.codexPath && !path.isAbsolute(data.codexPath) && data.codexPath !== 'codex') throw new Error('Use um caminho absoluto para o executável do Codex.')
    if (data.codexPath && path.isAbsolute(data.codexPath) && (!fs.existsSync(data.codexPath) || !fs.statSync(data.codexPath).isFile())) throw new Error('Executável do Codex não encontrado.')
    logger.setDiagnostic(Boolean(data.diagnosticMode))
    database.setSettings({ ...data, diagnosticMode: String(Boolean(data.diagnosticMode)) })
    return { ...database.getSettings(), diagnosticMode: Boolean(data.diagnosticMode) }
  })

  ipcMain.handle('documents:saveMarkdown', async (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string(), name: z.string().default('documento.md') }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    const result = await dialog.showSaveDialog(win, { title: 'Salvar documento Markdown', defaultPath: path.join(conversation.workspace, safeName(data.name, '.md')), filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (result.canceled || !result.filePath) return null
    assertInsideWorkspace(result.filePath, conversation.workspace)
    fs.writeFileSync(result.filePath, data.content, 'utf8')
    database.addArtifact(data.conversationId, conversation.workspace, 'document', path.basename(result.filePath), result.filePath, data.content, { format: 'md' })
    return result.filePath
  })

  ipcMain.handle('documents:export', async (_event, value: unknown) => {
    const data = z.object({ conversationId: z.string().uuid(), content: z.string(), format: z.enum(['docx', 'pdf', 'html']) }).parse(value)
    const conversation = getConversation(database, data.conversationId)
    const available = await commandVersion('pandoc')
    if (!available) throw new Error('Pandoc não foi encontrado no PATH.')
    const result = await dialog.showSaveDialog(win, { title: `Exportar ${data.format.toUpperCase()}`, defaultPath: path.join(conversation.workspace, `documento.${data.format}`), filters: [{ name: data.format.toUpperCase(), extensions: [data.format] }] })
    if (result.canceled || !result.filePath) return null
    assertInsideWorkspace(result.filePath, conversation.workspace)
    await pipeCommand('pandoc', ['-f', 'markdown', '-t', data.format, '-o', result.filePath], data.content, conversation.workspace)
    database.addArtifact(data.conversationId, conversation.workspace, 'document', path.basename(result.filePath), result.filePath, data.format === 'html' ? fs.readFileSync(result.filePath, 'utf8') : null, { format: data.format })
    return result.filePath
  })
}

function getConversation(database: LocalDatabase, id: string) {
  const conversation = database.listConversations().find((item) => item.id === id)
  if (!conversation) throw new Error('Conversa não encontrada.')
  return conversation
}

function assertKnownWorkspace(database: LocalDatabase, value: string) {
  const workspace = path.resolve(value)
  const known = [...database.listWorkspaces().map((item) => item.path), ...database.listConversations().map((item) => item.workspace)]
    .some((item) => path.resolve(item) === workspace)
  if (!known) throw new Error('Workspace não autorizado. Selecione-o pelo aplicativo antes de continuar.')
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) throw new Error('Workspace não encontrado.')
  return workspace
}

function assertWorkspace(conversation: ConversationRow) {
  const workspace = path.resolve(conversation.workspace)
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    throw new Error('O workspace desta conversa não está mais disponível.')
  }
}

function assertInsideWorkspace(filePath: string, workspace: string) {
  try { resolveInsideWorkspace(filePath, workspace) }
  catch { throw new Error('O arquivo precisa estar dentro do workspace selecionado.') }
}

function resolveWorkspaceFile(filePath: string, workspace: string) {
  return resolveInsideWorkspace(filePath, workspace)
}

function isTextFile(extension: string) {
  return new Set(['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.xml', '.yaml', '.yml', '.toml', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.sh', '.sql', '.env', '.gitignore']).has(extension)
}

function artifactType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) return 'image'
  if (extension === '.md') return 'markdown'
  if (['.json', '.yaml', '.yml', '.toml', '.env', '.ini'].includes(extension)) return 'configuration'
  if (['.docx', '.pdf', '.html'].includes(extension)) return 'document'
  return 'code'
}

async function run(command: string, args: string[], cwd: string) {
  try { return await execFileAsync(command, args, { cwd, timeout: 20_000, maxBuffer: 5_000_000 }) }
  catch (error) { throw new Error(error instanceof Error ? error.message : String(error)) }
}

async function getCodexInfo(codex: CodexClient) {
  const executable = findExecutable('codex')
  const version = await commandVersion(executable || 'codex')
  let config: unknown = null
  try { config = await codex.readConfig() } catch { /* status remains truthful through the Codex status event */ }
  const authStatus = executable ? await commandOutput(executable, ['login', 'status']) : null
  const parsedVersion = version?.match(/(\d+\.\d+\.\d+)/)?.[1]
  const compatible = Boolean(parsedVersion && compareVersions(parsedVersion, CODEX_COMPATIBILITY.minimum) >= 0)
  return { codexPath: executable || 'codex', codexVersion: version || 'indisponível', codexCompatible: compatible, codexCompatibilityMessage: parsedVersion ? compatible ? `Compatível (mínimo ${CODEX_COMPATIBILITY.minimum})` : `Versão incompatível; instale ${CODEX_COMPATIBILITY.minimum} ou superior.` : 'Não foi possível identificar a versão do Codex CLI.', pandocVersion: await commandVersion('pandoc') || 'indisponível', serverStatus: codex.status, authStatus: authStatus || 'Não foi possível verificar a autenticação.', authenticated: Boolean(authStatus && /logged in|autenticado/i.test(authStatus)), rawConfig: config }
}

function compareVersions(left: string, right: string) { const a = left.split('.').map(Number); const b = right.split('.').map(Number); for (let index = 0; index < 3; index += 1) { if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0) } return 0 }

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
async function commandOutput(command: string, args: string[]) { try { const { stdout, stderr } = await execFileAsync(command, args, { timeout: 5_000 }); return (stdout || stderr).trim() } catch { return null } }

function safeName(name: string, extension: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '-')
  return base.endsWith(extension) ? base : `${base}${extension}`
}

function pipeCommand(command: string, args: string[], input: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'ignore', 'pipe'] })
    let error = ''
    let settled = false
    const finish = (failure?: Error) => { if (settled) return; settled = true; clearTimeout(timer); failure ? reject(failure) : resolve() }
    const timer = setTimeout(() => { child.kill(); finish(new Error('A exportação excedeu o limite de 60 segundos.')) }, 60_000)
    child.stderr.on('data', (chunk) => { error = `${error}${chunk.toString()}`.slice(-64_000) })
    child.on('error', (failure) => finish(failure))
    child.on('exit', (code) => code === 0 ? finish() : finish(new Error(error || `Pandoc encerrou com código ${code}.`)))
    child.stdin.end(input)
  })
}

interface ProjectContext { name: string; stack: string[]; primaryLanguage: string; commands: Record<string, string> }

function ensureNocturneWorkspace(workspace: string) {
  const directory = path.join(workspace, '.nocturne')
  fs.mkdirSync(directory, { recursive: true })
  resolveInsideWorkspace(directory, workspace)
  const projectPath = path.join(directory, 'project.json')
  const memoryPath = path.join(directory, 'memory.md')
  const rulesPath = path.join(directory, 'rules.md')
  if (!fs.existsSync(projectPath)) fs.writeFileSync(projectPath, `${JSON.stringify(detectProject(workspace), null, 2)}\n`, 'utf8')
  if (!fs.existsSync(memoryPath)) fs.writeFileSync(memoryPath, '# Memória do projeto\n\nDecisões, arquitetura e informações aprendidas pelo agente.\n', 'utf8')
  if (!fs.existsSync(rulesPath)) fs.writeFileSync(rulesPath, '# Regras do projeto\n\nPreferências e padrões de código que o agente deve seguir.\n', 'utf8')
}

function readWorkspaceContext(workspace: string) {
  ensureNocturneWorkspace(workspace)
  const directory = path.join(workspace, '.nocturne')
  let project = detectProject(workspace)
  try { project = JSON.parse(fs.readFileSync(path.join(directory, 'project.json'), 'utf8')) as ProjectContext } catch { /* regenerate invalid metadata on save */ }
  const memoryPath = path.join(directory, 'memory.md')
  const rulesPath = path.join(directory, 'rules.md')
  const stats = [memoryPath, rulesPath].map((file) => fs.statSync(file).mtimeMs)
  return { content: fs.readFileSync(memoryPath, 'utf8'), rules: fs.readFileSync(rulesPath, 'utf8'), project, updatedAt: new Date(Math.max(...stats)).toISOString() }
}

function writeWorkspaceContext(workspace: string, content: string, rules: string) {
  ensureNocturneWorkspace(workspace)
  const directory = path.join(workspace, '.nocturne')
  fs.writeFileSync(path.join(directory, 'memory.md'), content, 'utf8')
  fs.writeFileSync(path.join(directory, 'rules.md'), rules, 'utf8')
  const project = detectProject(workspace)
  fs.writeFileSync(path.join(directory, 'project.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8')
  return { content, rules, project, updatedAt: new Date().toISOString() }
}

function detectProject(workspace: string): ProjectContext {
  const files = new Set(fs.readdirSync(workspace))
  const stack: string[] = []
  const commands: Record<string, string> = {}
  let primaryLanguage = 'Desconhecida'
  if (files.has('package.json')) {
    stack.push('Node.js'); primaryLanguage = files.has('tsconfig.json') ? 'TypeScript' : 'JavaScript'
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8')) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      Object.assign(commands, pkg.scripts ?? {})
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      for (const [dependency, label] of Object.entries({ react: 'React', vue: 'Vue', electron: 'Electron', next: 'Next.js', vite: 'Vite' })) if (deps[dependency]) stack.push(label)
    } catch { /* keep basic detection */ }
  }
  if (files.has('Cargo.toml')) { stack.push('Rust'); primaryLanguage = 'Rust'; commands.test = 'cargo test' }
  if (files.has('pyproject.toml') || files.has('requirements.txt')) { stack.push('Python'); primaryLanguage = 'Python'; commands.test ??= 'pytest' }
  if (files.has('go.mod')) { stack.push('Go'); primaryLanguage = 'Go'; commands.test = 'go test ./...' }
  return { name: path.basename(workspace), stack: [...new Set(stack)], primaryLanguage, commands }
}

function recordSuggestionDecision(workspace: string, suggestion: { title: string; status: string; updatedAt: string }) {
  ensureNocturneWorkspace(workspace)
  const memoryPath = path.join(workspace, '.nocturne', 'memory.md')
  if (fs.statSync(memoryPath).size > 1_000_000) return
  const icon = suggestion.status === 'rejected' ? '✕' : '✓'
  fs.appendFileSync(memoryPath, `\n- ${icon} ${suggestion.title} — ${suggestion.status} em ${new Date(suggestion.updatedAt).toLocaleDateString('pt-BR')}\n`, 'utf8')
}
