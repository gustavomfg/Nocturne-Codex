import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assessCommand, resolveInsideWorkspace } from '../electron/security/ExecutionPolicy'

describe('políticas de execução', () => {
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
