import { describe, expect, it } from 'vitest'
import { parseAwarenessSnapshot } from '../shared/awareness'

describe('snapshot de Awareness', () => {
  it('lê somente seleções estruturadas e limita relevância', () => {
    const valid = { id: 'memory-1', title: 'Decisão', source: 'brain-memory', sourceType: 'manual', sourceId: null, kind: 'decision', scope: 'workspace', relevance: 84, reason: 'Correspondência relevante.', updatedAt: null, contentPreview: 'Conteúdo' }
    const snapshot = parseAwarenessSnapshot(JSON.stringify({ awareness: { mode: 'review', createdAt: '2026-07-30T00:00:00.000Z', selections: [valid, { ...valid, id: 'invalid', relevance: 101 }] } }))
    expect(snapshot?.selections.map((item) => item.id)).toEqual(['memory-1'])
  })

  it('ignora metadados ausentes ou inválidos', () => {
    expect(parseAwarenessSnapshot(null)).toBeNull()
    expect(parseAwarenessSnapshot('{')).toBeNull()
    expect(parseAwarenessSnapshot(JSON.stringify({ awareness: { mode: 'unknown', selections: [] } }))).toBeNull()
  })
})
