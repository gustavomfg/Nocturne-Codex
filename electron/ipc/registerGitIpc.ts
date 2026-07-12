import { dialog, ipcMain, type BrowserWindow } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { LocalDatabase } from '../database/Database'
import { gitCommitSchema, idSchema } from '../../shared/ipc/schemas'
import { resolveInsideWorkspace } from '../security/ExecutionPolicy'

const run = promisify(execFile)

export function registerGitIpc(win: BrowserWindow, database: LocalDatabase) {
  ipcMain.handle('git:status', async (_event, value: unknown) => gitStatus(getWorkspace(database, idSchema.parse(value))))
  ipcMain.handle('git:commit', async (_event, value: unknown) => {
    const data = gitCommitSchema.parse(value)
    const workspace = getWorkspace(database, data.conversationId)
    const files = [...new Set(data.files)].map((file) => {
      resolveInsideWorkspace(path.resolve(workspace, file), workspace)
      return file
    })
    const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Preparar e criar commit'], defaultId: 0, cancelId: 0, title: 'Confirmar commit', message: `Criar commit no workspace ${path.basename(workspace)}?`, detail: `${files.length} arquivo(s) selecionado(s).\n\n${data.message}` })
    if (confirmation.response !== 1) throw new Error('Commit cancelado pelo usuário.')
    await run('git', ['add', '--', ...files], { cwd: workspace })
    const { stdout } = await run('git', ['commit', '-m', data.message], { cwd: workspace })
    return { output: stdout.trim() }
  })
}

function getWorkspace(database: LocalDatabase, id: string) {
  const conversation = database.listConversations().find((item) => item.id === id)
  if (!conversation) throw new Error('Conversa não encontrada.')
  return conversation.workspace
}

async function gitStatus(workspace: string) {
  const [branch, status, diff, staged] = await Promise.all([
    run('git', ['branch', '--show-current'], { cwd: workspace }), run('git', ['status', '--short'], { cwd: workspace }),
    run('git', ['diff', '--no-ext-diff'], { cwd: workspace }), run('git', ['diff', '--cached', '--no-ext-diff'], { cwd: workspace }),
  ])
  const files = status.stdout.split(/\r?\n/).filter(Boolean).map((line) => ({ status: line.slice(0, 2).trim() || 'M', path: line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop() as string }))
  return { branch: branch.stdout.trim() || '(detached)', status: status.stdout, diff: [diff.stdout, staged.stdout].filter(Boolean).join('\n'), files }
}
