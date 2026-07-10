import { z } from 'zod'

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

export const suggestionInputSchema = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(10_000), reasoning: z.string().trim().min(1).max(10_000),
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
export function sandboxModeForAgent(mode: AgentMode, configured: 'read-only' | 'workspace-write') { return mode === 'review' ? 'read-only' : configured }

export function suggestedCommit(suggestion: Pick<Suggestion, 'category' | 'title'>) {
  const type = suggestion.category === 'architecture' ? 'refactor' : suggestion.category === 'documentation' ? 'docs' : suggestion.category === 'testing' ? 'test' : suggestion.category === 'cleanup' ? 'chore' : 'fix'
  return `${type}(${suggestion.category}): ${suggestion.title.toLowerCase()}`.slice(0, 100)
}
