import type { Suggestion } from '../../types'

const severityWeight: Record<string, number> = { info: 0, low: 0.5, medium: 1, high: 2, critical: 3 }

export function projectHealth(suggestions: Suggestion[]) {
  const pending = suggestions.filter((item) => item.status === 'pending' || item.status === 'accepted')
  const metric = (categories: string[]) => {
    const relevant = pending.filter((item) => categories.includes(item.category))
    return {
      score: Math.max(1, Math.round(10 - relevant.reduce((sum, item) => sum + severityWeight[item.severity], 0))),
      explanation: relevant.length ? `${relevant.length} sugestão(ões) aberta(s); desconto proporcional à severidade.` : 'Nenhuma sugestão aberta nesta dimensão.',
    }
  }
  return {
    Arquitetura: metric(['architecture']),
    Segurança: metric(['security']),
    Testes: metric(['testing', 'bug']),
    Performance: metric(['performance']),
    Manutenção: metric(['cleanup', 'dependency', 'accessibility']),
    Documentação: metric(['documentation']),
  }
}

export type ProjectHealth = ReturnType<typeof projectHealth>
