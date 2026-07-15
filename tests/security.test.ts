import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assessCommand, resolveInsideWorkspace } from '../electron/security/ExecutionPolicy'

describe('políticas de execução', () => {
  it('mantém permissões web negadas e fuses essenciais no pacote', () => {
    const main = fs.readFileSync(path.join(process.cwd(), 'electron/main.ts'), 'utf8')
    const builder = fs.readFileSync(path.join(process.cwd(), 'electron-builder.json5'), 'utf8')
    expect(main).toContain('setPermissionCheckHandler(() => false)')
    expect(main).toContain('callback(false)')
    expect(builder).toMatch(/"runAsNode": false/)
    expect(builder).toMatch(/"onlyLoadAppFromAsar": true/)
  })
  it('gera metadados de atualização pelo GitHub sem consultar o serviço em desenvolvimento', () => {
    const builder = fs.readFileSync(path.join(process.cwd(), 'electron-builder.json5'), 'utf8')
    const updater = fs.readFileSync(path.join(process.cwd(), 'electron/updates/UpdateService.ts'), 'utf8')
    expect(builder).toContain('"provider": "github"')
    expect(builder).toContain('"repo": "Nocturne-Codex"')
    expect(updater).toContain('if (!app.isPackaged || process.env.NOCTURNE_PACKAGE_SMOKE_OUTPUT)')
    expect(updater).toContain('updater.autoDownload = false')
  })
  it('publica uma release estável somente após reunir e verificar as três plataformas', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/stable-release.yml'), 'utf8')
    expect(workflow).toContain('pattern: nocturne-signed-*')
    expect(workflow).toContain('npm run verify:release-assets -- release-assets')
    expect(workflow).toContain('gh release create "$RELEASE_TAG"')
    expect(workflow).toContain('tag !== \'v\'+v')
  })
  it('mantém o atalho de editor integrado ao WebStorm', () => {
    const workspaceIpc = fs.readFileSync(path.join(process.cwd(), 'electron/ipc/registerWorkspaceIpc.ts'), 'utf8')
    const topbar = fs.readFileSync(path.join(process.cwd(), 'src/domains/workspaces/WorkspaceTopbar.tsx'), 'utf8')
    expect(workspaceIpc).toContain("dependencies.run('webstorm', [workspace], workspace)")
    expect(workspaceIpc).toContain('Não foi possível abrir o WebStorm.')
    expect(topbar).toContain('aria-label="Abrir no WebStorm"')
  })
  it.each(['sudo apt update', 'git reset --hard HEAD', 'git clean -fd', 'rm -rf build', 'npm run rebuild:native', 'npm run package'])('marca comando perigoso: %s', (command) => expect(assessCommand(command)).toMatchObject({ risk: 'dangerous', requiresApproval: true, blockedAutomatic: true }))
  it('não usa substring ingênua para classificar nomes de arquivo', () => expect(assessCommand(['cat', 'sudo-notes.md']).risk).toBe('safe'))
  it('bloqueia traversal e aceita arquivo interno', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-security-'))
    expect(() => resolveInsideWorkspace('../secret', workspace)).toThrow(/fora do workspace/)
    expect(resolveInsideWorkspace('src/app.ts', workspace)).toBe(path.join(workspace, 'src/app.ts'))
    fs.rmSync(workspace, { recursive: true, force: true })
  })
  it('bloqueia symlink interno que aponta para fora do workspace', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-security-'))
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-outside-'))
    fs.symlinkSync(outside, path.join(workspace, 'escape'))
    expect(() => resolveInsideWorkspace('escape/secret.txt', workspace)).toThrow(/fora do workspace/)
    fs.rmSync(workspace, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true })
  })
})
