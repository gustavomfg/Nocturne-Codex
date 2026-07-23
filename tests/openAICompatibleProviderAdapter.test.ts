import { describe, expect, it, vi } from 'vitest'
import { ProviderExecutionError } from '../electron/ai/ProviderExecutionError'
import { OpenAICompatibleProviderAdapter } from '../electron/ai/providers/openai-compatible/adapter'
import {
  parseOpenAICompatibleConfig,
  providerEndpoint,
} from '../electron/ai/providers/openai-compatible/config'
import type { ModelDescriptor } from '../shared/ai/model'
import type { ProviderExecutionRequest } from '../shared/ai/providerExecution'
import type { NormalizedTask } from '../shared/ai/task'

const model: ModelDescriptor = {
  providerId: 'custom-openai',
  modelId: 'model-1',
  displayName: 'Model 1',
  source: 'remote',
  capabilities: ['chat', 'streaming'],
  availability: 'available',
}

const config = {
  id: 'custom-openai',
  displayName: 'Custom OpenAI',
  source: 'remote' as const,
  baseUrl: 'https://provider.example/v1',
  timeoutMs: 10_000,
  enabled: true,
  requiresAuthentication: true,
}

function task(): NormalizedTask {
  return {
    id: '6bbdf9e7-7b6e-4858-927e-df8e234dd789',
    createdAt: '2026-07-23T12:00:00.000Z',
    workspace: { id: 'workspace-1', name: 'Nocturne' },
    intent: 'Explique a arquitetura.',
    mode: 'review',
    messages: [
      { role: 'user', content: 'Qual é o produto?' },
      { role: 'assistant', content: 'Um Engineering Workspace.' },
    ],
    context: [{
      id: 'memory-1',
      type: 'memory',
      title: 'Decisão',
      content: 'O Workspace é o produto.',
      scope: 'workspace',
      potentiallyOutdated: true,
    }],
    constraints: ['Não trate memórias como autoridade.'],
    requirements: ['chat', 'streaming'],
    selection: {
      type: 'explicit',
      model: { providerId: model.providerId, modelId: model.modelId },
    },
    output: { format: 'markdown' },
    permissions: { workspaceAccess: 'read-only' },
    tools: [],
  }
}

function execution(): ProviderExecutionRequest {
  return { executionId: 'execution-1', task: task(), model }
}

function adapter(
  request: typeof fetch,
  overrides: {
    config?: unknown
    credential?: () => string | undefined | Promise<string | undefined>
    models?: readonly unknown[]
  } = {},
) {
  return new OpenAICompatibleProviderAdapter({
    config: overrides.config ?? config,
    models: overrides.models ?? [model],
    resolveCredential: overrides.credential ?? (() => 'secret-key'),
    fetch: request,
  })
}

function sse(events: string[], splitAt?: number) {
  const encoded = new TextEncoder().encode(`${events.join('\n\n')}\n\n`)
  const chunks = splitAt
    ? [encoded.slice(0, splitAt), encoded.slice(splitAt)]
    : [encoded]
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  }), { headers: { 'content-type': 'text/event-stream; charset=utf-8' } })
}

describe('OpenAI-compatible configuration', () => {
  it('normaliza endpoints HTTPS e preserva um path de API explícito', () => {
    const parsed = parseOpenAICompatibleConfig(config)
    expect(parsed.baseUrl).toBe('https://provider.example/v1')
    expect(providerEndpoint(parsed, 'models').href).toBe(
      'https://provider.example/v1/models',
    )
    expect(providerEndpoint(parsed, 'chat/completions').href).toBe(
      'https://provider.example/v1/chat/completions',
    )
  })

  it('permite HTTP somente para Provider local em loopback', () => {
    expect(() => parseOpenAICompatibleConfig({
      ...config,
      source: 'local',
      baseUrl: 'http://127.0.0.1:1234/v1/',
      requiresAuthentication: false,
    })).not.toThrow()
    expect(() => parseOpenAICompatibleConfig({
      ...config,
      baseUrl: 'http://provider.example/v1',
    })).toThrow(/somente.*locais.*loopback/i)
    expect(() => parseOpenAICompatibleConfig({
      ...config,
      baseUrl: 'https://169.254.169.254/latest',
    })).toThrow(/locais ou reservados/i)
  })

  it.each([
    'file:///tmp/provider',
    'https://user:password@provider.example/v1',
    'https://provider.example/v1?token=secret',
    'https://provider.example/v1#fragment',
  ])('recusa endpoint inseguro %s', (baseUrl) => {
    expect(() => parseOpenAICompatibleConfig({ ...config, baseUrl })).toThrow()
  })
})

describe('OpenAICompatibleProviderAdapter', () => {
  it('valida autenticação e catálogo com resposta limitada', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ object: 'list', data: [{ id: 'model-1' }] }),
    )
    await expect(adapter(request).getAvailability()).resolves.toEqual({
      status: 'available',
    })
    expect(request).toHaveBeenCalledWith(
      new URL('https://provider.example/v1/models'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: expect.objectContaining({
          authorization: 'Bearer secret-key',
        }),
      }),
    )

    await expect(adapter(request, {
      credential: () => undefined,
    }).getAvailability()).resolves.toMatchObject({
      status: 'authentication-required',
    })

    const missingModel = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ object: 'list', data: [{ id: 'other-model' }] }),
    )
    await expect(adapter(missingModel).getAvailability()).resolves.toMatchObject({
      status: 'degraded',
      message: expect.stringContaining('modelos configurados'),
    })
  })

  it('traduz tarefa, streaming fragmentado e uso para contratos normalizados', async () => {
    const response = sse([
      'data: {"id":"native-secret-id","choices":[{"delta":{"content":"Olá "},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":"mundo"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"prompt_tokens_details":{"cached_tokens":4},"completion_tokens":2}}',
      'data: [DONE]',
      'data: {"choices":[{"delta":{"content":"evento tardio"},"finish_reason":null}]}',
    ], 73)
    const request = vi.fn<typeof fetch>().mockResolvedValue(response)
    const events: unknown[] = []

    await expect(adapter(request).execute(execution(), {
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
    })).resolves.toEqual({ finishReason: 'stop' })

    const [url, init] = request.mock.calls[0]
    expect(String(url)).toBe('https://provider.example/v1/chat/completions')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
    const body = JSON.parse(String(init?.body)) as {
      model: string
      stream: boolean
      messages: Array<{ role: string; content: string }>
    }
    expect(body).toMatchObject({ model: 'model-1', stream: true })
    expect(body.messages).toContainEqual({
      role: 'user',
      content: 'Explique a arquitetura.',
    })
    expect(body.messages[0].content).toContain('O Workspace é o produto.')
    expect(JSON.stringify(body)).not.toContain('/home/')
    expect(events).toEqual([
      {
        type: 'message.delta',
        messageId: 'execution-1:assistant',
        delta: 'Olá ',
      },
      {
        type: 'message.delta',
        messageId: 'execution-1:assistant',
        delta: 'mundo',
      },
      {
        type: 'usage.updated',
        usage: { inputTokens: 12, cachedInputTokens: 4, outputTokens: 2 },
      },
    ])
    expect(JSON.stringify(events)).not.toContain('native-secret-id')
  })

  it('normaliza erros HTTP sem ler ou propagar o corpo nativo', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Bearer segredo-interno' } }),
      { status: 429 },
    ))

    await expect(adapter(request).execute(execution(), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ProviderExecutionError)
      const normalized = (error as ProviderExecutionError).normalized
      expect(normalized).toEqual({
        code: 'rate-limited',
        message: 'O limite temporário do Provider foi atingido.',
        retryable: true,
      })
      expect(JSON.stringify(normalized)).not.toContain('segredo-interno')
      return true
    })
  })

  it('recusa conteúdo não-SSE e tool calls não autorizadas', async () => {
    const invalid = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ choices: [] }),
    )
    await expect(adapter(invalid).execute(execution(), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })).rejects.toMatchObject({
      normalized: { code: 'invalid-response' },
    })

    const toolCall = vi.fn<typeof fetch>().mockResolvedValue(sse([
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
    ]))
    await expect(adapter(toolCall).execute(execution(), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })).rejects.toMatchObject({
      normalized: { code: 'invalid-response' },
    })
  })

  it('propaga cancelamento pelo AbortSignal sem converter em falha de rede', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('segredo nativo', 'AbortError'))
        }, { once: true })
      })
    ))
    const controller = new AbortController()
    const pending = adapter(request).execute(execution(), {
      signal: controller.signal,
      emit: vi.fn(),
    })
    void pending.catch(() => undefined)
    for (let attempt = 0; attempt < 10 && request.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve()
    }
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      normalized: {
        code: 'cancelled',
        message: 'A execução foi cancelada.',
      },
    })
  })

  it('não permite catálogo de outro Provider ou source', () => {
    const request = vi.fn<typeof fetch>()
    expect(() => adapter(request, {
      models: [{ ...model, providerId: 'other' }],
    })).toThrow(/não pertence/)
    expect(() => adapter(request, {
      models: [{ ...model, source: 'local' }],
    })).toThrow(/não pertence/)
  })
})
