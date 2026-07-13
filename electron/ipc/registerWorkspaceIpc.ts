import { dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { z } from 'zod'
import type { LocalDatabase } from '../database/Database'
import { idSchema, workspaceFavoriteSchema, workspaceToolSchema } from '../../shared/ipc/schemas'
import { safeIpcMain } from './safeIpc'

interface Dependencies {
  ensureWorkspace(workspace: string): void
  assertKnownWorkspace(value: string): string
  run(command: string, args: string[], cwd: string): Promise<unknown>
}

export function registerWorkspaceIpc(win: BrowserWindow, database: LocalDatabase, dependencies: Dependencies) {
  const ipcMain = safeIpcMain(win)
  ipcMain.handle('workspace:select', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Selecionar workspace' })
    if (result.canceled || !result.filePaths[0]) return null
    database.touchWorkspace(result.filePaths[0]); dependencies.ensureWorkspace(result.filePaths[0]); return result.filePaths[0]
  })
  ipcMain.handle('workspace:validate', (_event, value: unknown) => { const resolved = path.resolve(z.string().min(1).parse(value)); return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : null })
  ipcMain.handle('workspaces:list', () => database.listWorkspaces())
  ipcMain.handle('workspaces:remove', (_event, value: unknown) => database.removeWorkspace(z.string().min(1).parse(value)))
  ipcMain.handle('workspaces:favorite', (_event, value: unknown) => { const data = workspaceFavoriteSchema.parse(value); dependencies.assertKnownWorkspace(data.workspace); database.setWorkspaceFavorite(data.workspace, data.favorite) })
  ipcMain.handle('workspace:openTool', async (_event, value: unknown) => {
    const data = workspaceToolSchema.parse(value); const workspace = dependencies.assertKnownWorkspace(data.workspace)
    if (!fs.existsSync(workspace)) throw new Error('Workspace não encontrado.')
    if (data.tool === 'editor') { try { await dependencies.run('code', [workspace], workspace) } catch { throw new Error('Não foi possível abrir o VS Code. Verifique se o comando “code” está no PATH.') } return }
    const terminal = process.platform === 'win32' ? ['cmd', ['/K', 'cd', '/d', workspace]] as const : process.platform === 'darwin' ? ['open', ['-a', 'Terminal', workspace]] as const : ['x-terminal-emulator', ['--working-directory', workspace]] as const
    const child = spawn(terminal[0], [...terminal[1]], { cwd: workspace, detached: true, stdio: 'ignore' }); child.unref()
  })
  ipcMain.handle('conversations:list', () => database.listConversations())
  ipcMain.handle('conversations:create', (_event, value: unknown) => { const workspace = dependencies.assertKnownWorkspace(z.string().min(1).parse(value)); dependencies.ensureWorkspace(workspace); return database.createConversation(workspace) })
  ipcMain.handle('conversations:messages', (_event, value: unknown) => database.listMessages(idSchema.parse(value)))
  ipcMain.handle('conversations:delete', (_event, value: unknown) => database.deleteConversation(idSchema.parse(value)))
  return () => ipcMain.dispose()
}
