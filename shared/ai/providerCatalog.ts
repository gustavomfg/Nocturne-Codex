import type { ProviderConfigurationInput } from './providerConfiguration'

export type ProviderCatalogId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'deepseek'
  | 'ollama'
  | 'lm-studio'

export type ProviderConnectionKind = 'api-key' | 'account' | 'local'
export type ProviderIntegrationStatus = 'available' | 'adapter-required'

export interface ProviderConnectionMethod {
  kind: ProviderConnectionKind
  label: string
  status: 'available' | 'unavailable'
  detail: string
}

export interface ProviderCatalogEntry {
  id: ProviderCatalogId
  displayName: string
  description: string
  source: 'local' | 'remote'
  integrationStatus: ProviderIntegrationStatus
  protocol: string
  baseUrl?: string
  requiresAuthentication: boolean
  connectionMethods: ProviderConnectionMethod[]
}

export const providerCatalog: readonly ProviderCatalogEntry[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'Modelos da OpenAI Platform usando sua própria chave de API.',
    source: 'remote',
    integrationStatus: 'available',
    protocol: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    requiresAuthentication: true,
    connectionMethods: [
      {
        kind: 'api-key',
        label: 'Chave da API',
        status: 'available',
        detail: 'A cobrança da OpenAI Platform é separada da assinatura do ChatGPT.',
      },
      {
        kind: 'account',
        label: 'Conta ChatGPT',
        status: 'unavailable',
        detail: 'Planos ChatGPT não concedem acesso geral à API.',
      },
    ],
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude via integração oficial da Anthropic.',
    source: 'remote',
    integrationStatus: 'adapter-required',
    protocol: 'Messages API',
    requiresAuthentication: true,
    connectionMethods: [
      {
        kind: 'api-key',
        label: 'Chave da Console',
        status: 'unavailable',
        detail: 'Requer o adapter dedicado da Messages API.',
      },
      {
        kind: 'account',
        label: 'Conta Claude',
        status: 'unavailable',
        detail: 'Somente fluxos oficiais de conta poderão ser habilitados.',
      },
    ],
  },
  {
    id: 'google',
    displayName: 'Google',
    description: 'Gemini via Google AI Studio ou Vertex AI.',
    source: 'remote',
    integrationStatus: 'adapter-required',
    protocol: 'Gemini API',
    requiresAuthentication: true,
    connectionMethods: [
      {
        kind: 'api-key',
        label: 'Google AI Studio',
        status: 'unavailable',
        detail: 'Requer o adapter dedicado e discovery de capabilities do Gemini.',
      },
      {
        kind: 'account',
        label: 'Conta Google',
        status: 'unavailable',
        detail: 'OAuth será oferecido somente com escopos oficiais e mínimos.',
      },
    ],
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    description: 'Um catálogo amplo de modelos usando sua chave OpenRouter.',
    source: 'remote',
    integrationStatus: 'available',
    protocol: 'OpenAI-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresAuthentication: true,
    connectionMethods: [
      {
        kind: 'api-key',
        label: 'Chave OpenRouter',
        status: 'available',
        detail: 'Inclui modelos gratuitos e pagos conforme sua conta.',
      },
    ],
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    description: 'Modelos DeepSeek usando sua chave da plataforma.',
    source: 'remote',
    integrationStatus: 'available',
    protocol: 'OpenAI-compatible',
    baseUrl: 'https://api.deepseek.com',
    requiresAuthentication: true,
    connectionMethods: [
      {
        kind: 'api-key',
        label: 'Chave DeepSeek',
        status: 'available',
        detail: 'O uso da API segue os preços e limites da conta DeepSeek.',
      },
    ],
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    description: 'Modelos executados localmente pelo runtime Ollama.',
    source: 'local',
    integrationStatus: 'available',
    protocol: 'OpenAI-compatible',
    baseUrl: 'http://127.0.0.1:11434/v1',
    requiresAuthentication: false,
    connectionMethods: [
      {
        kind: 'local',
        label: 'Runtime local',
        status: 'available',
        detail: 'Nenhuma chave é necessária no endereço loopback padrão.',
      },
    ],
  },
  {
    id: 'lm-studio',
    displayName: 'LM Studio',
    description: 'Servidor local OpenAI-compatible do LM Studio.',
    source: 'local',
    integrationStatus: 'available',
    protocol: 'OpenAI-compatible',
    baseUrl: 'http://127.0.0.1:1234/v1',
    requiresAuthentication: false,
    connectionMethods: [
      {
        kind: 'local',
        label: 'Servidor local',
        status: 'available',
        detail: 'Inicie o servidor do LM Studio antes de validar a conexão.',
      },
    ],
  },
] as const

export function providerCatalogEntry(
  id: ProviderCatalogId,
): ProviderCatalogEntry {
  const entry = providerCatalog.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Provider desconhecido: ${id}`)
  return entry
}

export function configurationFromProviderCatalog(
  id: ProviderCatalogId,
): ProviderConfigurationInput | undefined {
  const entry = providerCatalogEntry(id)
  if (entry.integrationStatus !== 'available' || !entry.baseUrl) return undefined
  return {
    providerType: 'openai-compatible',
    displayName: entry.displayName,
    source: entry.source,
    baseUrl: entry.baseUrl,
    enabled: false,
    requiresAuthentication: entry.requiresAuthentication,
    timeoutMs: 30_000,
  }
}
