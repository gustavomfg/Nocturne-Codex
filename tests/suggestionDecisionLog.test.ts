import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appendSuggestionDecision } from '../electron/persistence/SuggestionDecisionLog'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('SuggestionDecisionLog', () => {
  it('serializa decisões concorrentes em uma única seção e preserva permissões restritas', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-decisions-')); directories.push(directory)
    const memoryPath = path.join(directory, 'memory.md')
    fs.writeFileSync(memoryPath, '# Memória\n', { mode: 0o600 })
    await Promise.all([
      appendSuggestionDecision(memoryPath, { title: 'Primeira', status: 'accepted', updatedAt: '2026-07-29T10:00:00.000Z' }),
      appendSuggestionDecision(memoryPath, { title: 'Segunda', status: 'rejected', updatedAt: '2026-07-29T10:00:01.000Z' }),
    ])
    const content = fs.readFileSync(memoryPath, 'utf8')
    expect(content.match(/nocturne:suggestion-history/g)).toHaveLength(1)
    expect(content).toContain('"title":"Primeira"')
    expect(content).toContain('"title":"Segunda"')
    expect(fs.statSync(memoryPath).mode & 0o777).toBe(0o600)
  })
})
