import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../src/store'

beforeEach(() => useAppStore.setState({ streaming: '', activities: [] }))

describe('limites de estabilidade do renderer', () => {
  it('limita o buffer acumulado da resposta', () => {
    useAppStore.getState().appendStream('x'.repeat(2_100_000))
    expect(useAppStore.getState().streaming).toHaveLength(2_000_000)
  })
  it('mantém apenas as atividades recentes e limita detalhes', () => {
    for (let index = 0; index < 350; index += 1) useAppStore.getState().upsertActivity({ id: String(index), type: 'read', label: 'Leitura', detail: 'x'.repeat(70_000), status: 'completed' })
    const activities = useAppStore.getState().activities
    expect(activities).toHaveLength(300)
    expect(activities[0].id).toBe('50')
    expect(activities.at(-1)?.detail).toHaveLength(64_000)
  })
})
