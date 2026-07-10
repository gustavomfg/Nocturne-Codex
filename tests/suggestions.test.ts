import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '../electron/database/Database'
import { extractSuggestions, sandboxModeForAgent, suggestedCommit } from '../shared/suggestions'

const directories: string[] = []
const tempDirectory = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-suggestions-')); directories.push(directory); return directory }
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

const input = { title: 'Restringir IPC', description: 'O renderer possui acesso amplo.', reasoning: 'Reduzir a superfície evita acesso indevido.', category: 'security' as const, severity: 'high' as const, affectedFiles: ['electron/preload.ts'], proposedChanges: '- broadApi\n+ narrowApi', expectedBenefits: ['Menor superfície de ataque'], complexity: 'medium' as const, risk: 'low' as const }

describe('sugestões', () => {
  it('extrai apenas sugestões estruturadas e remove o bloco da resposta', () => {
    const response = `Análise concluída.\n\n\`\`\`nocturne-suggestions\n${JSON.stringify([input])}\n\`\`\``
    const result = extractSuggestions(response)
    expect(result.content).toBe('Análise concluída.')
    expect(result.suggestions).toEqual([input])
  })

  it('persiste, recarrega e registra mudanças válidas de status', () => {
    const directory = tempDirectory(); let db = new LocalDatabase(directory); const conversation = db.createConversation('/tmp/project')
    const suggestion = db.addSuggestion(conversation.id, conversation.workspace, input)
    expect(suggestion.status).toBe('pending')
    expect(db.setSuggestionStatus(suggestion.id, 'accepted').status).toBe('accepted')
    expect(db.setSuggestionStatus(suggestion.id, 'applied', 'typecheck ok').status).toBe('applied')
    db.close(); db = new LocalDatabase(directory)
    expect(db.listSuggestions(conversation.id)[0]).toMatchObject({ id: suggestion.id, status: 'applied', affectedFiles: input.affectedFiles })
    db.close()
  })

  it('persiste rejeição e impede reabrir uma decisão terminal', () => {
    const db = new LocalDatabase(tempDirectory()); const conversation = db.createConversation('/tmp/project'); const suggestion = db.addSuggestion(conversation.id, conversation.workspace, input)
    expect(db.setSuggestionStatus(suggestion.id, 'rejected').status).toBe('rejected')
    expect(() => db.setSuggestionStatus(suggestion.id, 'accepted')).toThrow(/Transição.*inválida/)
    db.close()
  })

  it('Review Mode sempre usa somente leitura', () => {
    expect(sandboxModeForAgent('review', 'workspace-write')).toBe('read-only')
    expect(sandboxModeForAgent('build', 'workspace-write')).toBe('workspace-write')
    expect(suggestedCommit({ category: 'security', title: 'Restringir IPC' })).toBe('fix(security): restringir ipc')
  })
})
