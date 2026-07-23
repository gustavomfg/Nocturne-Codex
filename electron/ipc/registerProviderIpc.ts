import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { ProviderAvailability } from '../../shared/ai/provider'
import type {
  ProviderConfigurationSummary,
} from '../../shared/ai/providerConfiguration'
import { providerConfigurationSummarySchema } from '../../shared/ai/providerConfigurationSchemas'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import type { ProviderConfigurationIpcResult } from '../../shared/ipc/contracts'
import {
  providerConfigurationCreateSchema,
  providerConfigurationIdSchema,
  providerConfigurationUpdateSchema,
} from '../../shared/ipc/schemas'
import {
  ProviderConfigurationServiceError,
  type ProviderCredentialChange,
} from '../ai/ProviderConfigurationService'
import { safeIpcMain } from './safeIpc'

export interface ProviderConfigurationOperations {
  list(): ProviderConfigurationSummary[]
  create(
    input: unknown,
    change?: ProviderCredentialChange,
  ): Promise<ProviderConfigurationSummary>
  update(
    id: string,
    input: unknown,
    change?: ProviderCredentialChange,
  ): Promise<ProviderConfigurationSummary>
  remove(id: string): Promise<boolean>
  testConnection(id: string): Promise<ProviderAvailability>
}

const availabilitySchema = z.object({
  status: z.enum([
    'not-configured',
    'validating',
    'available',
    'degraded',
    'offline',
    'authentication-required',
    'incompatible',
    'disabled',
  ]),
  message: z.string().max(2_000).optional(),
  checkedAt: z.string().datetime({ offset: true }).optional(),
}).strict()

export function registerProviderIpc(
  win: BrowserWindow,
  service: ProviderConfigurationOperations,
) {
  const ipcMain = safeIpcMain(win)

  ipcMain.handle(IPC_CHANNELS.providers.list, () => execute(() =>
    z.array(providerConfigurationSummarySchema).parse(service.list())))

  ipcMain.handle(IPC_CHANNELS.providers.create, (_event, input: unknown) =>
    execute(async () => {
      const value = providerConfigurationCreateSchema.parse(input)
      return providerConfigurationSummarySchema.parse(
        await service.create(value.configuration, { credential: value.credential }),
      )
    }))

  ipcMain.handle(IPC_CHANNELS.providers.update, (_event, input: unknown) =>
    execute(async () => {
      const value = providerConfigurationUpdateSchema.parse(input)
      return providerConfigurationSummarySchema.parse(
        await service.update(value.id, value.configuration, {
          credential: value.credential,
          clearCredential: value.clearCredential,
        }),
      )
    }))

  ipcMain.handle(IPC_CHANNELS.providers.remove, (_event, input: unknown) =>
    execute(async () => {
      const value = providerConfigurationIdSchema.parse(input)
      return await service.remove(value.id)
    }))

  ipcMain.handle(IPC_CHANNELS.providers.testConnection, (_event, input: unknown) =>
    execute(async () => {
      const value = providerConfigurationIdSchema.parse(input)
      return availabilitySchema.parse(await service.testConnection(value.id))
    }))

  return () => ipcMain.dispose()
}

async function execute<T>(
  operation: () => T | Promise<T>,
): Promise<ProviderConfigurationIpcResult<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    if (error instanceof ProviderConfigurationServiceError) {
      const availability = error.availability
        ? availabilitySchema.safeParse(error.availability)
        : undefined
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message.slice(0, 2_000),
          ...(availability?.success
            ? { availability: availability.data }
            : {}),
        },
      }
    }
    return {
      ok: false,
      error: {
        code: error instanceof z.ZodError
          ? 'invalid-configuration'
          : 'operation-failed',
        message: error instanceof z.ZodError
          ? 'A requisição de configuração do Provider é inválida.'
          : 'Não foi possível concluir a operação do Provider.',
      },
    }
  }
}
