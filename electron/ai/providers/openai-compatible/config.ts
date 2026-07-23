import { isIP } from 'node:net'
import { z } from 'zod'
import type { ProviderSource } from '../../../../shared/ai/provider'
import { PROVIDER_CONFIGURATION_LIMITS } from '../../../../shared/ai/providerConfiguration'

export const OPENAI_COMPATIBLE_LIMITS = {
  models: 25_000,
  modelsResponseBytes: 2 * 1024 * 1024,
  streamResponseBytes: 10 * 1024 * 1024,
  streamEventBytes: 1024 * 1024,
} as const

const configSchema = z.object({
  id: z.string().trim().min(1).max(512),
  displayName: z.string().trim().min(1).max(500),
  source: z.enum(['local', 'remote']),
  baseUrl: z.string().trim().min(1).max(2_048),
  timeoutMs: z.number().int()
    .min(PROVIDER_CONFIGURATION_LIMITS.minimumTimeoutMs)
    .max(PROVIDER_CONFIGURATION_LIMITS.maximumTimeoutMs),
  enabled: z.boolean(),
  requiresAuthentication: z.boolean(),
}).strict()

export interface OpenAICompatibleConfig {
  id: string
  displayName: string
  source: ProviderSource
  baseUrl: string
  timeoutMs: number
  enabled: boolean
  requiresAuthentication: boolean
}

export function parseOpenAICompatibleConfig(input: unknown): OpenAICompatibleConfig {
  const config = configSchema.parse(input)
  const baseUrl = validateBaseUrl(config.baseUrl, config.source)
  return { ...config, baseUrl: baseUrl.href.replace(/\/$/, '') }
}

export function providerEndpoint(config: OpenAICompatibleConfig, resource: 'models' | 'chat/completions') {
  const base = new URL(`${config.baseUrl}/`)
  const path = `${base.pathname.replace(/\/$/, '')}/${resource}`.replace(/\/{2,}/g, '/')
  base.pathname = path
  return base
}

function validateBaseUrl(value: string, source: ProviderSource) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('O endpoint OpenAI-compatible é inválido.')
  }
  if (url.username || url.password) {
    throw new Error('O endpoint não pode conter credenciais.')
  }
  if (url.search || url.hash) {
    throw new Error('O endpoint não pode conter query ou fragmento.')
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('O endpoint deve usar HTTP ou HTTPS.')
  }

  const loopback = isLoopbackHost(url.hostname)
  if (url.protocol === 'http:' && (!loopback || source !== 'local')) {
    throw new Error('HTTP sem TLS é permitido somente para Providers locais em loopback.')
  }
  if (source === 'remote' && isUnsafeRemoteHost(url.hostname)) {
    throw new Error('Providers remotos não podem usar endereços locais ou reservados.')
  }
  return url
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[(.*)]$/, '$1').toLowerCase()
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
}

function isUnsafeRemoteHost(hostname: string) {
  const normalized = hostname.replace(/^\[(.*)]$/, '$1').toLowerCase()
  if (normalized === 'localhost' || normalized === 'metadata.google.internal') return true
  const family = isIP(normalized)
  if (family === 4) {
    const parts = normalized.split('.').map(Number)
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] === 0
  }
  if (family === 6) {
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || /^fe[89ab]/.test(normalized)
  }
  return false
}
