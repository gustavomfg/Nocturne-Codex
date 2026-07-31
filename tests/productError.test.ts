import { describe, expect, it } from 'vitest'
import { explainProductError } from '../src/shared/productError'

describe('explicação acionável de erros', () => {
  it.each([
    ['insufficient_quota: billing required', 'Créditos insuficientes na API', false],
    ['401 unauthorized', 'Autenticação necessária', false],
    ['rate limit 429', 'Limite temporário do Provider', true],
    ['O Provider excedeu o tempo permitido.', 'A operação excedeu o tempo limite', true],
    ['ECONNREFUSED', 'Não foi possível alcançar o serviço', true],
    ['Workspace não autorizado.', 'O workspace precisa de atenção', false],
    ['Banco SQLite corrompido.', 'A persistência local não pôde concluir a operação', false],
  ])('classifica %s', (message, title, retryable) => {
    expect(explainProductError(message)).toMatchObject({ title, retryable, cause: message })
  })

  it('mantém um fallback com preservação e próximo passo', () => {
    const result = explainProductError('Falha desconhecida.')
    expect(result.preserved).toContain('dados já salvos foram preservados')
    expect(result.resolution).toContain('exporte o diagnóstico')
  })
})
