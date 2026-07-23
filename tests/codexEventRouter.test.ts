import { describe, expect, it, vi } from 'vitest'
import { routeAgentEvent } from '../src/domains/agent/routeCodexEvent'

const handlers = () => ({ stream: vi.fn(), activityDetail: vi.fn(), diff: vi.fn(), plan: vi.fn(), hasPlan: vi.fn(() => false), itemStarted: vi.fn(), itemCompleted: vi.fn(), fsChanged: vi.fn(), approval: vi.fn(), turnCompleted: vi.fn(), error: vi.fn(), warning: vi.fn() })

describe('roteamento de eventos do agente', () => {
  it('normaliza planos e encaminha conclusão uma única vez por evento', () => {
    const target = handlers()
    routeAgentEvent({ method: 'turn/plan/updated', params: { plan: [{ step: 'Validar', status: 'in_progress' }], explanation: 'Plano' } }, target)
    routeAgentEvent({ method: 'turn/completed', params: { turn: { id: 'turn-1' } } }, target)
    expect(target.plan).toHaveBeenCalledWith([{ step: 'Validar', status: 'inProgress' }], 'Plano')
    expect(target.turnCompleted).toHaveBeenCalledTimes(1)
  })

  it('descarta delta de plano quando já existe um plano ativo', () => {
    const target = handlers(); target.hasPlan.mockReturnValue(true)
    routeAgentEvent({ method: 'item/plan/delta', params: { delta: 'atrasado' } }, target)
    expect(target.plan).not.toHaveBeenCalled()
  })
})
