import { describe, expect, it } from 'vitest'
import { agentModeInstructions, extractBrainMemoryCandidates } from '../shared/suggestions'

describe('extração de candidatas de memória', () => {
  it('extrai blocos válidos, aplica limites e remove metadados da resposta', () => {
    const values = Array.from({ length: 7 }, (_, index) => ({ kind: index ? 'learning' : 'decision', scope: index % 2 ? 'conversation' : 'workspace', content: `Conhecimento durável ${index}`, confidence: 60 + index }))
    const content = `Resposta útil.\n\n\`\`\`nocturne-memories\n${JSON.stringify(values)}\n\`\`\``
    const extracted = extractBrainMemoryCandidates(content)
    expect(extracted.content).toBe('Resposta útil.')
    expect(extracted.candidates).toHaveLength(5)
    expect(extracted.candidates[0]).toEqual({ kind: 'decision', scope: 'workspace', content: 'Conhecimento durável 0', confidence: 60 })
  })

  it('ignora blocos inválidos e orienta todos os modos sem ativação automática', () => {
    expect(extractBrainMemoryCandidates('Texto\n```nocturne-memories\n{"kind":"secret","content":"token"}\n```')).toEqual({ candidates: [], content: 'Texto' })
    expect(extractBrainMemoryCandidates('Texto\n```nocturne-memories\n{"kind":"fact","scope":"workspace","content":"authorization: Bearer abcdefghijklmnop","confidence":90}\n```')).toEqual({ candidates: [], content: 'Texto' })
    for (const mode of ['build', 'review', 'docs'] as const) {
      const instructions = agentModeInstructions(mode)
      expect(instructions).toContain('bloco é opcional')
      expect(instructions).toContain('apenas candidata')
      expect(instructions).toContain('Não inclua credenciais')
    }
  })
})
