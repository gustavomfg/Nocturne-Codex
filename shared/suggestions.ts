import { z } from 'zod'
import { brainMemoryKinds, brainMemoryScopes, isSafeBrainMemoryContent, type BrainMemoryCandidate } from './brainMemory'

export const suggestionCategories = ['architecture', 'security', 'performance', 'bug', 'cleanup', 'testing', 'documentation', 'dependency', 'accessibility'] as const
export const suggestionSeverities = ['info', 'low', 'medium', 'high', 'critical'] as const
export const suggestionStatuses = ['pending', 'accepted', 'rejected', 'applied'] as const
export const agentModes = ['build', 'review', 'docs'] as const
export type SuggestionCategory = typeof suggestionCategories[number]
export type SuggestionSeverity = typeof suggestionSeverities[number]
export type SuggestionStatus = typeof suggestionStatuses[number]
export type AgentMode = typeof agentModes[number]

export interface Suggestion {
  id: string; workspaceId: string; conversationId: string; title: string; description: string; reasoning: string
  category: SuggestionCategory; severity: SuggestionSeverity; affectedFiles: string[]; proposedChanges: string; expectedBenefits: string[]; complexity: 'low' | 'medium' | 'high'; risk: 'low' | 'medium' | 'high'
  createdAt: string; updatedAt: string; status: SuggestionStatus
}

export function sanitizeSuggestionTitle(value: string) {
  return value.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim()
}

export const suggestionInputSchema = z.object({
  title: z.string().max(200).transform(sanitizeSuggestionTitle).pipe(z.string().min(1).max(200)), description: z.string().trim().min(1).max(10_000), reasoning: z.string().trim().min(1).max(10_000),
  category: z.enum(suggestionCategories), severity: z.enum(suggestionSeverities), affectedFiles: z.array(z.string().trim().min(1).max(1_000)).max(100).default([]), proposedChanges: z.string().max(100_000).default(''), expectedBenefits: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]), complexity: z.enum(['low', 'medium', 'high']).default('medium'), risk: z.enum(['low', 'medium', 'high']).default('medium'),
})

const blockPattern = /```nocturne-suggestions\s*\n([\s\S]*?)```/gi
export function extractSuggestions(content: string) {
  const suggestions: z.infer<typeof suggestionInputSchema>[] = []
  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(content)) !== null) {
    try { const parsed: unknown = JSON.parse(match[1]); for (const value of Array.isArray(parsed) ? parsed : [parsed]) { const result = suggestionInputSchema.safeParse(value); if (result.success) suggestions.push(result.data) } } catch { /* bloco incompleto é ignorado */ }
  }
  return { suggestions, content: content.replace(blockPattern, '').trim() }
}

export function reviewInstructions() {
  return `Você está no Review Mode do Nocturne Codex. Analise e proponha; não altere arquivos, não instale dependências e não execute comandos que modifiquem o workspace. Use somente leitura. Toda melhoria concreta deve ser publicada ao final em um único bloco JSON válido:\n\n\`\`\`nocturne-suggestions\n[{"title":"...","description":"problema e impacto","reasoning":"evidências e justificativa","category":"architecture|security|performance|bug|cleanup|testing|documentation|dependency|accessibility","severity":"info|low|medium|high|critical","affectedFiles":["caminho/relativo"],"proposedChanges":"diff ou descrição precisa da solução","expectedBenefits":["benefício verificável"],"complexity":"low|medium|high","risk":"low|medium|high"}]\n\`\`\`\n\nNão aplique as propostas. O usuário decidirá separadamente.`
}
const memoryBlockPattern = /```nocturne-memories\s*\n([\s\S]*?)```/gi
const memoryCandidateSchema = z.object({ kind: z.enum(brainMemoryKinds), scope: z.enum(brainMemoryScopes), content: z.string().trim().min(1).max(8_000).refine(isSafeBrainMemoryContent, 'A memória parece conter uma credencial.'), confidence: z.number().int().min(0).max(100).default(60) }).strict()

export function extractBrainMemoryCandidates(content: string) {
  const candidates: BrainMemoryCandidate[] = []
  let match: RegExpExecArray | null
  memoryBlockPattern.lastIndex = 0
  while ((match = memoryBlockPattern.exec(content)) !== null && candidates.length < 5) {
    try {
      const parsed: unknown = JSON.parse(match[1])
      for (const value of Array.isArray(parsed) ? parsed : [parsed]) {
        const result = memoryCandidateSchema.safeParse(value)
        if (result.success && candidates.length < 5) candidates.push(result.data)
      }
    } catch { /* bloco incompleto é ignorado */ }
  }
  memoryBlockPattern.lastIndex = 0
  return { candidates, content: content.replace(memoryBlockPattern, '').trim() }
}

export function brainMemoryCandidateInstructions() {
  return `Se este turno revelar uma decisão, preferência, restrição, fato estável ou aprendizado realmente útil em trabalhos futuros, você pode propor até cinco lembranças ao final em um único bloco JSON válido. Não inclua credenciais, tokens, conteúdo integral de arquivos, estado transitório, suposições ou informações já presentes no contexto. O bloco é opcional; omita-o quando não houver conhecimento durável. Toda entrada será apenas candidata e dependerá de aprovação do usuário:\n\n\`\`\`nocturne-memories\n[{"kind":"fact|decision|preference|constraint|learning","scope":"workspace|conversation","content":"...","confidence":60}]\n\`\`\``
}
export function agentModeInstructions(mode: AgentMode) {
  const modeInstructions = mode === 'review' ? reviewInstructions()
    : mode === 'docs' ? 'Você está no Docs Mode do Nocturne Codex neste turno. Restrições de Review Mode de turnos anteriores estão desativadas. Você pode criar ou alterar somente documentação diretamente relacionada ao pedido, respeitando o sandbox e as aprovações atuais. Valide links, comandos e exemplos quando possível.'
      : 'Você está no Build Mode do Nocturne Codex neste turno. Restrições de Review Mode de turnos anteriores estão desativadas. Você pode modificar o workspace e executar validações conforme o pedido, sempre respeitando o sandbox e as aprovações atuais. Implemente a alteração solicitada em vez de apenas propor uma sugestão.'
  return `${modeInstructions}\n\n${brainMemoryCandidateInstructions()}`
}
export function sandboxModeForAgent(mode: AgentMode, configured: 'read-only' | 'workspace-write') { return mode === 'review' ? 'read-only' : configured }

export function suggestedCommit(suggestion: Pick<Suggestion, 'category' | 'title'>) {
  const type = suggestion.category === 'architecture' ? 'refactor' : suggestion.category === 'documentation' ? 'docs' : suggestion.category === 'testing' ? 'test' : suggestion.category === 'cleanup' ? 'chore' : 'fix'
  return `${type}(${suggestion.category}): ${suggestion.title.toLowerCase()}`.slice(0, 100)
}
