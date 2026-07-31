import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { persistCompletedTurn } from '../electron/ai/TurnPersistence'
import { LocalDatabase } from '../electron/database/Database'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('persistCompletedTurn', () => {
  it('salva a resposta e coleções derivadas antes de notificar o renderer', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-turn-')); directories.push(directory)
    const database = new LocalDatabase(directory)
    const conversation = database.createConversation('/tmp/turn-workspace')
    const memory = '```nocturne-memories\n[{"kind":"learning","scope":"conversation","content":"Preservar respostas no processo principal.","confidence":90}]\n```'
    const suggestion = '```nocturne-suggestions\n[{"title":"Persistir no main","description":"Evitar perda.","reasoning":"O renderer pode reiniciar.","category":"bug","severity":"high","affectedFiles":["electron/main.ts"],"proposedChanges":"Persistir primeiro.","expectedBenefits":["Recuperação"],"complexity":"medium","risk":"low"}]\n```'
    const persisted = persistCompletedTurn(database, {
      conversationId: conversation.id, workspace: conversation.workspace, mode: 'review',
      content: `Análise concluída.\n\n${memory}\n\n${suggestion}`, diff: 'diff atual',
      files: ['electron/main.ts'], plan: [{ step: 'Persistir', status: 'completed' }], planExplanation: 'Durabilidade',
    })
    expect(persisted.warning).toBeUndefined()
    expect(persisted.message?.content).toContain('Análise concluída.')
    expect(persisted.message?.content).toContain('Comparação com a revisão anterior')
    expect(persisted.message?.content).toContain('Novas: 1')
    expect(database.listMessages(conversation.id)).toEqual([expect.objectContaining({ id: persisted.message?.id, role: 'assistant' })])
    expect(database.listBrainMemoryPage(conversation.workspace).items).toHaveLength(1)
    expect(database.listSuggestions(conversation.id)).toEqual([expect.objectContaining({ title: 'Persistir no main' })])
    const artifactTitles = database.listArtifacts(conversation.id).map((artifact) => artifact.title)
    expect(artifactTitles.some((title) => title.startsWith('Resposta ·'))).toBe(true)
    expect(artifactTitles).toEqual(expect.arrayContaining(['main.ts', 'Alterações do turno']))
    database.close()
  })
})
