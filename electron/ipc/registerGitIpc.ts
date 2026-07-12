import { dialog, type BrowserWindow } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { LocalDatabase } from '../database/Database'
import { gitCommitSchema, idSchema } from '../../shared/ipc/schemas'
import { resolveInsideWorkspace } from '../security/ExecutionPolicy'
import { safeIpcMain } from './safeIpc'

const run = promisify(execFile)

export function registerGitIpc(win: BrowserWindow, database: LocalDatabase) {
  const ipcMain = safeIpcMain(win)
  ipcMain.handle('git:status', async (_event, value: unknown) => gitStatus(getWorkspace(database, idSchema.parse(value))))
  ipcMain.handle('git:commit', async (_event, value: unknown) => {
    const data = gitCommitSchema.parse(value)
    const workspace = getWorkspace(database, data.conversationId)
    const current = await gitStatus(workspace)
    const files = resolveSelectedGitFiles(current.files, data.files).map((file) => {
      resolveInsideWorkspace(path.resolve(workspace, file), workspace)
      return file
    })
    const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Preparar e criar commit'], defaultId: 0, cancelId: 0, title: 'Confirmar commit', message: `Criar commit no workspace ${path.basename(workspace)}?`, detail: `${files.length} arquivo(s) selecionado(s).\n\n${data.message}` })
    if (confirmation.response !== 1) throw new Error('Commit cancelado pelo usuário.')
    await run('git', ['add', '-A', '--', ...files], { cwd: workspace })
    const { stdout } = await run('git', ['commit', '-m', data.message], { cwd: workspace })
    return { output: stdout.trim() }
  })
}

export function resolveSelectedGitFiles(currentFiles: Array<{ path: string; originalPath?: string }>, requestedFiles: string[]) {
  if (!requestedFiles.length) throw new Error('Selecione ao menos um arquivo para criar o commit.')
  const currentByPath = new Map(currentFiles.map((file) => [file.path, file]))
  const missing = requestedFiles.filter((file) => !currentByPath.has(file))
  if (missing.length) throw new Error(`A seleção do Git ficou desatualizada. Atualize o painel e tente novamente: ${missing.join(', ')}`)
  const expanded = requestedFiles.flatMap((file) => {
    const current = currentByPath.get(file)!
    return [current.path, ...(current.originalPath ? [current.originalPath] : [])]
  })
  return [...new Set(expanded)]
}

function getWorkspace(database: LocalDatabase, id: string) {
  const conversation = database.listConversations().find((item) => item.id === id)
  if (!conversation) throw new Error('Conversa não encontrada.')
  return conversation.workspace
}

async function gitStatus(workspace: string) {
  const [branch, status, diff, staged] = await Promise.all([
    run('git', ['branch', '--show-current'], { cwd: workspace }), run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: workspace }),
    run('git', ['diff', '--no-ext-diff'], { cwd: workspace }), run('git', ['diff', '--cached', '--no-ext-diff'], { cwd: workspace }),
  ])
  const files = parsePorcelainZ(status.stdout)
  return { branch: branch.stdout.trim() || '(detached)', status: files.map((file) => `${file.status.padEnd(2)} ${file.originalPath ? `${file.originalPath} → ` : ''}${file.path}`).join('\n'), diff: [diff.stdout, staged.stdout].filter(Boolean).join('\n'), files }
}

export function parsePorcelainZ(output: string) {
  const records = output.split('\0')
  const files: Array<{ path: string; status: string; originalPath?: string }> = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (!record) continue
    const status = record.slice(0, 2).trim() || 'M'
    const path = record.slice(3)
    if (status.includes('R') || status.includes('C')) {
      const originalPath = records[index + 1]
      index += 1
      files.push({ status, path, ...(originalPath ? { originalPath } : {}) })
    } else files.push({ status, path })
  }
  return files
}
