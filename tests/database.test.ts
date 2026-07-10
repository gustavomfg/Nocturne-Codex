import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '../electron/database/Database'

const directories: string[] = []
const create = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-')); directories.push(directory); return new LocalDatabase(directory) }
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('persistência SQLite', () => {
  it('persiste conversa, thread, mensagens, memória e artefatos', () => {
    const db = create(); const workspace = '/tmp/workspace'; const conversation = db.createConversation(workspace)
    db.setThread(conversation.id, 'thread-1'); db.addMessage(conversation.id, 'user', 'Olá'); db.setWorkspaceMemory(workspace, 'decisão'); db.addArtifact(conversation.id, workspace, 'markdown', 'Resposta', null, '# ok')
    expect(db.listConversations()[0].codexThreadId).toBe('thread-1')
    expect(db.listMessages(conversation.id)).toHaveLength(1)
    expect(db.getWorkspaceMemory(workspace).content).toBe('decisão')
    expect(db.listArtifacts(conversation.id)[0].type).toBe('markdown'); db.close()
  })
  it('exporta e importa um fluxo completo restaurável', () => {
    const source = create(); const conversation = source.createConversation('/tmp/project'); source.addMessage(conversation.id, 'assistant', 'Resposta simulada'); const data = source.exportData(); source.close()
    const target = create(); target.importData(data); expect(target.listConversations()).toHaveLength(1); expect(target.listMessages(conversation.id)[0].content).toBe('Resposta simulada'); target.close()
  })
})
