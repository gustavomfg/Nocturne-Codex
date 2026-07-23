import { describe, expect, it, vi } from 'vitest'
import { ProviderRegistry, ProviderRegistryError, type ProviderAdapter } from '../electron/ai/ProviderRegistry'

function adapter(id: string, overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    definition: { id, displayName: id.toUpperCase(), source: 'remote' },
    getAvailability: () => ({ status: 'available' }),
    listModels: () => [],
    execute: () => ({ finishReason: 'stop' }),
    ...overrides,
  }
}

describe('ProviderRegistry', () => {
  it('registra, lista e resolve adapters sem expor a coleção interna', () => {
    const registry = new ProviderRegistry()
    const openAi = adapter('openai')
    registry.register(openAi)

    const listed = registry.list()
    listed[0].displayName = 'Alterado'

    expect(registry.resolve('openai')).toBe(openAi)
    expect(registry.list()).toEqual([
      { id: 'openai', displayName: 'OPENAI', source: 'remote' },
    ])
  })

  it('rejeita identificadores duplicados com erro normalizado', () => {
    const registry = new ProviderRegistry()
    registry.register(adapter('ollama'))

    expect(() => registry.register(adapter('ollama'))).toThrow(
      expect.objectContaining<Partial<ProviderRegistryError>>({
        code: 'duplicate-provider',
      }),
    )
  })

  it('delega disponibilidade ao adapter selecionado', async () => {
    const getAvailability = vi.fn().mockResolvedValue({
      status: 'degraded',
      message: 'Catálogo temporariamente indisponível.',
    })
    const registry = new ProviderRegistry()
    registry.register(adapter('openrouter', { getAvailability }))

    await expect(registry.getAvailability('openrouter')).resolves.toEqual({
      status: 'degraded',
      message: 'Catálogo temporariamente indisponível.',
    })
    expect(getAvailability).toHaveBeenCalledOnce()
  })

  it('falha de forma explícita ao resolver um provider ausente', () => {
    const registry = new ProviderRegistry()

    expect(() => registry.resolve('missing')).toThrow(
      expect.objectContaining<Partial<ProviderRegistryError>>({
        code: 'provider-not-found',
      }),
    )
  })

  it('remove e encerra adapters de forma determinística', async () => {
    const disposeOpenAi = vi.fn()
    const disposeOllama = vi.fn()
    const registry = new ProviderRegistry()
    registry.register(adapter('openai', { dispose: disposeOpenAi }))
    registry.register(adapter('ollama', { dispose: disposeOllama }))

    await expect(registry.unregister('openai')).resolves.toBe(true)
    expect(disposeOpenAi).toHaveBeenCalledOnce()
    await expect(registry.unregister('openai')).resolves.toBe(false)

    await registry.dispose()
    expect(disposeOllama).toHaveBeenCalledOnce()
    expect(registry.list()).toEqual([])
  })

  it('troca o adapter antes do descarte e preserva o novo se o descarte falhar', async () => {
    const registry = new ProviderRegistry()
    const previous = adapter('openai', {
      dispose: vi.fn().mockRejectedValue(new Error('falha nativa com segredo')),
    })
    const next = adapter('openai')
    registry.register(previous)

    await expect(registry.replace(next)).resolves.toMatchObject({
      replaced: true,
      disposalError: expect.any(Error),
    })
    expect(registry.resolve('openai')).toBe(next)
  })
})
