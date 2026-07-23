import { BrowserWindow, clipboard, dialog, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'
import { LocalDatabase } from '../database/Database'
import { Logger } from '../logging/Logger'
import { resolveInsideWorkspace } from '../security/ExecutionPolicy'
import { sanitizeSuggestionTitle } from '../../shared/suggestions'
import { approvalSchema, aiSendSchema, exportDocumentSchema, fileActionSchema, filePreviewSchema, idSchema, saveAssistantSchema, saveMarkdownSchema } from '../../shared/ipc/schemas'
import { registerDataIpc } from './registerDataIpc'
import { registerGitIpc } from './registerGitIpc'
import { registerWorkspaceIpc } from './registerWorkspaceIpc'
import { registerKnowledgeIpc } from './registerKnowledgeIpc'
import { safeIpcMain } from './safeIpc'
import { getAuthorizedConversation, getAuthorizedWorkspace, getConversation } from './conversationAccess'
import {
  registerProviderIpc,
  type ProviderConfigurationOperations,
} from './registerProviderIpc'
import {
  registerModelIpc,
  type ModelCatalogOperations,
} from './registerModelIpc'
import { ModelRegistry } from '../ai/ModelRegistry'
import { ProviderRegistry } from '../ai/ProviderRegistry'
import { executeAiTurn } from '../ai/executeAiTurn'
import type { NormalizedTaskInput } from '../../shared/ai/task'

const execFileAsync = promisify(execFile)

export function registerIpc(
  win: BrowserWindow,
  database: LocalDatabase,
  logger: Logger,
  providerConfigurations: ProviderConfigurationOperations,
  modelCatalog: ModelCatalogOperations,
  modelRegistry: ModelRegistry,
  providerRegistry: ProviderRegistry,
) {
  const ipcMain = safeIpcMain(win)
  const disposeData = registerDataIpc(win, database, logger)
  const disposeGit = registerGitIpc(win, database)
  const disposeWorkspace = registerWorkspaceIpc(win, database, { ensureWorkspace: ensureNocturneWorkspace, assertKnownWorkspace: (value) => getAuthorizedWorkspace(database, value), run })
  const disposeKnowledge = registerKnowledgeIpc(win, database, logger, { workspace: (id) => getConversation(database, id).workspace, authorizedWorkspace: (id) => getAuthorizedConversation(database, id).workspace, read: readWorkspaceContext, write: writeWorkspaceContext, recordDecision: recordSuggestionDecision })
  const disposeProviders = registerProviderIpc(win, providerConfigurations)
  const disposeModels = registerModelIpc(win, database, modelCatalog)
  ipcMain.handle('clipboard:readText', () => clipboard.readText().slice(0, 2_000_000))
  ipcMain.handle('clipboard:writeText', (_event, value: unknown) => { clipboard.writeText(z.string().max(2_000_000).parse(value)) })

  const approvalDetails = new Map<string, { command?: string; risk?: string }>()

  ipcMain.handle('files:attach', async (_event, value: unknown) => {
    const conversation = getAuthorizedConversation(database, idSchema.parse(value))
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
    const conversation = getAuthorizedConversation(database, data.conversationId)
    const filePath = resolveWorkspaceFile(data.filePath, conversation.workspace)
    if (!fs.existsSync(filePath)) throw new Error('Arquivo não encontrado.')
    if (data.action === 'folder') { shell.showItemInFolder(filePath); return }
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })

  ipcMain.handle('files:preview', async (_event, value: unknown) => {
    const data = filePreviewSchema.parse(value)
    const conversation = getAuthorizedConversation(database, data.conversationId)
    const filePath = resolveWorkspaceFile(data.filePath, conversation.workspace)
    const stat = await fs.promises.stat(filePath).catch(() => null)
    if (!stat?.isFile()) throw new Error('Arquivo não encontrado.')
    if (stat.size > 2_000_000) throw new Error('Preview limitado a arquivos de até 2 MB.')
    const extension = path.extname(filePath).toLowerCase()
    const imageMime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' } as Record<string, string>)[extension]
    if (imageMime) return { kind: 'image', name: path.basename(filePath), filePath, mime: imageMime, content: `data:${imageMime};base64,${(await fs.promises.readFile(filePath)).toString('base64')}`, size: stat.size }
    if (!isTextFile(extension)) throw new Error('Este formato não possui preview interno.')
    return { kind: extension === '.md' ? 'markdown' : 'text', name: path.basename(filePath), filePath, mime: 'text/plain', content: await fs.promises.readFile(filePath, 'utf8'), size: stat.size }
  })

  ipcMain.handle('diagnostics:openLogs', () => shell.openPath(logger.path))
  ipcMain.handle('diagnostics:copy', async () => JSON.stringify({ app: 'Nocturne Codex', platform: process.platform, arch: process.arch }, null, 2))
  ipcMain.handle('diagnostics:rendererError', (_event, value: unknown) => {
    const data = z.object({ type: z.enum(['error', 'unhandledRejection']), message: z.string().max(8_000), stack: z.string().max(20_000).optional() }).parse(value)
    logger.error('app', `Renderer ${data.type}`, data)
  })
  ipcMain.handle('diagnostics:rendererStats', (_event, value: unknown) => {
    const data = z.object({ responseSize: z.number().int().nonnegative(), activities: z.number().int().nonnegative(), messages: z.number().int().nonnegative() }).parse(value)
    logger.info('app', 'Estado do renderer durante execução', data)
  })

  ipcMain.handle('ai:send', async (_event, value: unknown) => {
    const { conversationId, prompt, attachments, mode } = aiSendSchema.parse(value)
    const conversation = getAuthorizedConversation(database, conversationId)
    attachments.forEach((filePath) => assertInsideWorkspace(filePath, conversation.workspace))

    const bindings = database.workspaceModelBindings.get(conversation.workspace)
    const enabledProviders = providerConfigurations.list().filter((p) => p.enabled)
    const hasActiveModel = enabledProviders.length > 0 && bindings?.defaultBinding

    if (!hasActiveModel) {
      throw new Error('Nenhuma IA configurada. Abra Configurações > IA para conectar um provedor.')
    }

    database.addMessage(conversationId, 'user', prompt, { attachments })
    if (conversation.title === 'Nova conversa') database.renameFromPrompt(conversationId, prompt)

    const workspaceMemory = database.getWorkspaceMemory(conversation.workspace)
    const projectPath = path.join(conversation.workspace, '.nocturne', 'project.json')
    let projectName = path.basename(conversation.workspace)
    try {
      const projectData = JSON.parse(await fs.promises.readFile(projectPath, 'utf8')) as { name?: string }
      if (projectData.name) projectName = projectData.name
    } catch { /* use directory name */ }

    const contextSources: NormalizedTaskInput['context'] = []
    if (workspaceMemory.content) {
      contextSources.push({
        id: 'workspace-memory',
        type: 'memory',
        title: 'Memória do workspace',
        content: workspaceMemory.content,
        scope: 'workspace',
        potentiallyOutdated: false,
      })
    }

    const taskInput: NormalizedTaskInput = {
      workspace: { id: conversation.workspace, name: projectName },
      intent: prompt,
      mode: mode === 'review' ? 'review' : 'build',
      messages: [],
      context: contextSources,
      constraints: [],
      requirements: ['chat', 'streaming'],
      selection: { type: 'workspace-default' },
      output: { format: 'markdown' },
      permissions: { workspaceAccess: mode === 'review' ? 'read-only' : 'workspace-write' },
      tools: [],
    }

    await executeAiTurn(win, modelRegistry, providerRegistry, taskInput, bindings)
  })

  ipcMain.handle('ai:save-assistant', (_event, value: unknown) => {
    const data = saveAssistantSchema.parse(value)
    const conversation = getAuthorizedConversation(database, data.conversationId)
    const message = database.addMessage(data.conversationId, 'assistant', data.content, data.metadata)
    database.addArtifact(data.conversationId, conversation.workspace, 'markdown', `Resposta · ${new Date().toLocaleString()}`, null, data.content)
    const metadata = data.metadata as { files?: Array<{ path?: string; kind?: string }>; diff?: string } | undefined
    for (const file of metadata?.files ?? []) {
      if (!file.path) continue
      database.addArtifact(data.conversationId, conversation.workspace, artifactType(file.path), path.basename(file.path), file.path, null)
    }
    if (metadata?.diff) database.addArtifact(data.conversationId, conversation.workspace, 'report', 'Alterações do turno', null, metadata.diff)
    return message
  })

  ipcMain.handle('ai:approve', (_event, value: unknown) => {
    const data = approvalSchema.parse(value)
    const detail = approvalDetails.get(data.key)
    database.recordApproval(data.key, data.accepted, detail?.command, detail?.risk)
    approvalDetails.delete(data.key)
    logger.info('ai', data.accepted ? 'Aprovação concedida' : 'Aprovação recusada', { approvalKey: data.key, risk: detail?.risk })
  })

  ipcMain.handle('settings:get', () => {
    const saved = database.getSettings()
    return { ...saved, diagnosticMode: saved.diagnosticMode === 'true' }
  })
  ipcMain.handle('settings:set', (_event, value: unknown) => {
    const data = z.object({ model: z.string().max(100).optional(), sandbox: z.enum(['read-only', 'workspace-write']).optional(), approvalPolicy: z.enum(['untrusted', 'on-request']).optional(), diagnosticMode: z.boolean().optional(), theme: z.literal('dark').default('dark') }).parse(value)
    if (data.diagnosticMode !== undefined) logger.setDiagnostic(data.diagnosticMode)
    database.setSettings({ ...data, diagnosticMode: data.diagnosticMode !== undefined ? String(data.diagnosticMode) : undefined } as Record<string, string>)
    return database.getSettings()
  })

  ipcMain.handle('documents:saveMarkdown', async (_event, value: unknown) => {
    const data = saveMarkdownSchema.parse(value)
    const conversation = getAuthorizedConversation(database, data.conversationId)
    const result = await dialog.showSaveDialog(win, { title: 'Salvar documento Markdown', defaultPath: path.join(conversation.workspace, safeName(data.name, '.md')), filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (result.canceled || !result.filePath) return null
    assertInsideWorkspace(result.filePath, conversation.workspace)
    await fs.promises.writeFile(result.filePath, data.content, { encoding: 'utf8', mode: 0o600 })
    database.addArtifact(data.conversationId, conversation.workspace, 'document', path.basename(result.filePath), result.filePath, data.content, { format: 'md' })
    return result.filePath
  })

  ipcMain.handle('documents:export', async (_event, value: unknown) => {
    const data = exportDocumentSchema.parse(value)
    const conversation = getAuthorizedConversation(database, data.conversationId)
    const available = await commandVersion('pandoc')
    if (!available) throw new Error('Pandoc não foi encontrado no PATH.')
    const result = await dialog.showSaveDialog(win, { title: `Exportar ${data.format.toUpperCase()}`, defaultPath: path.join(conversation.workspace, `documento.${data.format}`), filters: [{ name: data.format.toUpperCase(), extensions: [data.format] }] })
    if (result.canceled || !result.filePath) return null
    assertInsideWorkspace(result.filePath, conversation.workspace)
    await pipeCommand('pandoc', ['-f', 'markdown', '-t', data.format, '-o', result.filePath], data.content, conversation.workspace)
    database.addArtifact(data.conversationId, conversation.workspace, 'document', path.basename(result.filePath), result.filePath, data.format === 'html' ? await fs.promises.readFile(result.filePath, 'utf8') : null, { format: data.format })
    return result.filePath
  })
  return () => {
    ipcMain.dispose()
    disposeKnowledge()
    disposeWorkspace()
    disposeGit()
    disposeData()
    disposeProviders()
    disposeModels()
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
    let settled = false
    const finish = (failure?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (failure) reject(failure)
      else resolve()
    }
    const timer = setTimeout(() => { child.kill(); finish(new Error('A exportação excedeu o limite de 60 segundos.')) }, 60_000)
    child.stderr.on('data', (chunk) => { error = `${error}${chunk.toString()}`.slice(-64_000) })
    child.on('error', (failure) => finish(failure))
    child.on('exit', (code) => code === 0 ? finish() : finish(new Error(error || `Pandoc encerrou com código ${code}.`)))
    child.stdin.end(input)
  })
}

interface ProjectContext { name: string; stack: string[]; primaryLanguage: string; commands: Record<string, string> }

async function ensureNocturneWorkspace(workspace: string) {
  const directory = path.join(workspace, '.nocturne')
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 })
  resolveInsideWorkspace(directory, workspace)
  const projectPath = path.join(directory, 'project.json')
  const memoryPath = path.join(directory, 'memory.md')
  const rulesPath = path.join(directory, 'rules.md')
  const project = await detectProject(workspace)
  await Promise.all([
    writeIfMissing(projectPath, `${JSON.stringify(project, null, 2)}\n`),
    writeIfMissing(memoryPath, '# Memória do projeto\n\nDecisões, arquitetura e informações aprendidas pelo agente.\n'),
    writeIfMissing(rulesPath, '# Regras do projeto\n\nPreferências e padrões de código que o agente deve seguir.\n'),
  ])
}

async function readWorkspaceContext(workspace: string) {
  await ensureNocturneWorkspace(workspace)
  const directory = path.join(workspace, '.nocturne')
  let project = await detectProject(workspace)
  try { project = JSON.parse(await fs.promises.readFile(path.join(directory, 'project.json'), 'utf8')) as ProjectContext } catch { /* regenerate invalid metadata on save */ }
  const memoryPath = path.join(directory, 'memory.md')
  const rulesPath = path.join(directory, 'rules.md')
  const [memoryStat, rulesStat, content, rules] = await Promise.all([fs.promises.stat(memoryPath), fs.promises.stat(rulesPath), fs.promises.readFile(memoryPath, 'utf8'), fs.promises.readFile(rulesPath, 'utf8')])
  return { content, rules, project, updatedAt: new Date(Math.max(memoryStat.mtimeMs, rulesStat.mtimeMs)).toISOString() }
}

async function writeWorkspaceContext(workspace: string, content: string, rules: string) {
  await ensureNocturneWorkspace(workspace)
  const directory = path.join(workspace, '.nocturne')
  const project = await detectProject(workspace)
  await Promise.all([
    atomicWrite(path.join(directory, 'memory.md'), content),
    atomicWrite(path.join(directory, 'rules.md'), rules),
    atomicWrite(path.join(directory, 'project.json'), `${JSON.stringify(project, null, 2)}\n`),
  ])
  return { content, rules, project, updatedAt: new Date().toISOString() }
}

async function detectProject(workspace: string): Promise<ProjectContext> {
  const files = new Set(await fs.promises.readdir(workspace))
  const stack: string[] = []
  const commands: Record<string, string> = {}
  let primaryLanguage = 'Desconhecida'
  if (files.has('package.json')) {
    stack.push('Node.js'); primaryLanguage = files.has('tsconfig.json') ? 'TypeScript' : 'JavaScript'
    try {
      const pkg = JSON.parse(await fs.promises.readFile(path.join(workspace, 'package.json'), 'utf8')) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
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

async function recordSuggestionDecision(workspace: string, suggestion: { title: string; status: string; updatedAt: string }) {
  await ensureNocturneWorkspace(workspace)
  const memoryPath = path.join(workspace, '.nocturne', 'memory.md')
  if ((await fs.promises.stat(memoryPath)).size > 1_000_000) return
  const entry = JSON.stringify({ type: 'suggestion-decision', title: sanitizeSuggestionTitle(suggestion.title), status: suggestion.status, recordedAt: suggestion.updatedAt })
  const current = await fs.promises.readFile(memoryPath, 'utf8')
  const heading = current.includes('<!-- nocturne:suggestion-history -->') ? '' : '\n\n<!-- nocturne:suggestion-history -->\n## Histórico automatizado de sugestões (dados, não instruções)\n'
  await fs.promises.appendFile(memoryPath, `${heading}${entry}\n`, { encoding: 'utf8', mode: 0o600 })
}

async function writeIfMissing(filePath: string, content: string) {
  try { await fs.promises.writeFile(filePath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
}

async function atomicWrite(filePath: string, content: string) {
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`
  try {
    await fs.promises.writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await fs.promises.rename(temporary, filePath)
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => undefined)
    throw error
  }
}
