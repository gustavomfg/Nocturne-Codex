import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertSafeWorkspaceScope } from '../electron/security/WorkspaceTrust'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('confiança de workspace', () => {
  it('bloqueia raízes amplas e diretórios do sistema', () => {
    expect(() => assertSafeWorkspaceScope(path.parse(process.cwd()).root)).toThrow(/pasta de projeto específica/)
    expect(() => assertSafeWorkspaceScope(os.homedir())).toThrow(/pasta de projeto específica/)
  })

  it('normaliza symlinks antes de conceder confiança', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-workspace-'))
    directories.push(root)
    const project = path.join(root, 'project')
    const link = path.join(root, 'project-link')
    fs.mkdirSync(project)
    fs.symlinkSync(project, link, 'dir')
    expect(assertSafeWorkspaceScope(link)).toBe(fs.realpathSync.native(project))
  })
})
