import { describe, expect, it } from 'vitest'
import { assessCommand, resolveInsideWorkspace } from '../electron/security/ExecutionPolicy'

describe('políticas de execução', () => {
  it.each(['sudo apt update', 'git reset --hard HEAD', 'git clean -fd', 'rm -rf build', 'npm run rebuild:native', 'npm run package'])('marca comando perigoso: %s', (command) => expect(assessCommand(command)).toMatchObject({ risk: 'dangerous', requiresApproval: true, blockedAutomatic: true }))
  it('não usa substring ingênua para classificar nomes de arquivo', () => expect(assessCommand(['cat', 'sudo-notes.md']).risk).toBe('safe'))
  it('bloqueia traversal e aceita arquivo interno', () => {
    expect(() => resolveInsideWorkspace('../secret', '/tmp/project')).toThrow(/fora do workspace/)
    expect(resolveInsideWorkspace('src/app.ts', '/tmp/project')).toBe('/tmp/project/src/app.ts')
  })
})
