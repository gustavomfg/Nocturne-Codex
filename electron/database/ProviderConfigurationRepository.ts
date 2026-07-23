import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../../shared/ai/providerConfiguration'
import { providerConfigurationInputSchema } from '../../shared/ai/providerConfigurationSchemas'
import { z } from 'zod'

const identifierSchema = z.string().uuid()

interface ProviderConfigurationRow {
  id: string
  providerType: ProviderConfigurationInput['providerType']
  displayName: string
  source: ProviderConfigurationInput['source']
  baseUrl: string
  enabled: number
  requiresAuthentication: number
  credentialRef: string | null
  timeoutMs: number
  createdAt: string
  updatedAt: string
}

export class ProviderConfigurationRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): ProviderConfigurationSummary[] {
    return (this.database.prepare(`${providerConfigurationSelect}
      ORDER BY enabled DESC, updated_at DESC`).all() as ProviderConfigurationRow[])
      .map(toSummary)
  }

  get(id: string): ProviderConfigurationSummary | null {
    const validatedId = identifierSchema.parse(id)
    const row = this.database.prepare(`${providerConfigurationSelect} WHERE id=?`)
      .get(validatedId) as ProviderConfigurationRow | undefined
    return row ? toSummary(row) : null
  }

  create(
    input: unknown,
    credentialReference: string | null = null,
  ): ProviderConfigurationSummary {
    const value = providerConfigurationInputSchema.parse(input)
    const id = identifierSchema.parse(this.createId())
    const credentialRef = parseCredentialReference(credentialReference)
    const timestamp = this.now().toISOString()
    this.database.prepare(`INSERT INTO provider_configs(
      id,provider_type,display_name,source,base_url,enabled,
      requires_authentication,credential_ref,timeout_ms,created_at,updated_at
    ) VALUES(
      @id,@providerType,@displayName,@source,@baseUrl,@enabled,
      @requiresAuthentication,@credentialRef,@timeoutMs,@createdAt,@updatedAt
    )`).run({
      id,
      ...value,
      enabled: value.enabled ? 1 : 0,
      requiresAuthentication: value.requiresAuthentication ? 1 : 0,
      credentialRef,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    return this.get(id) as ProviderConfigurationSummary
  }

  update(
    id: string,
    input: unknown,
    credentialReference?: string | null,
  ): ProviderConfigurationSummary {
    const validatedId = identifierSchema.parse(id)
    const value = providerConfigurationInputSchema.parse(input)
    const credentialRef = credentialReference === undefined
      ? undefined
      : parseCredentialReference(credentialReference)
    const changed = this.database.prepare(`UPDATE provider_configs SET
      provider_type=@providerType,display_name=@displayName,source=@source,
      base_url=@baseUrl,enabled=@enabled,
      requires_authentication=@requiresAuthentication,timeout_ms=@timeoutMs,
      ${credentialRef === undefined ? '' : 'credential_ref=@credentialRef,'}
      updated_at=@updatedAt
      WHERE id=@id`).run({
      id: validatedId,
      ...value,
      enabled: value.enabled ? 1 : 0,
      requiresAuthentication: value.requiresAuthentication ? 1 : 0,
      ...(credentialRef === undefined ? {} : { credentialRef }),
      updatedAt: this.now().toISOString(),
    })
    if (!changed.changes) throw new Error('Configuração de Provider não encontrada.')
    return this.get(validatedId) as ProviderConfigurationSummary
  }

  setCredentialReference(id: string, reference: string | null): ProviderConfigurationSummary {
    const validatedId = identifierSchema.parse(id)
    const credentialRef = parseCredentialReference(reference)
    const changed = this.database.prepare(`UPDATE provider_configs
      SET credential_ref=?,updated_at=? WHERE id=?`)
      .run(credentialRef, this.now().toISOString(), validatedId)
    if (!changed.changes) throw new Error('Configuração de Provider não encontrada.')
    return this.get(validatedId) as ProviderConfigurationSummary
  }

  getCredentialReference(id: string): string | null {
    const validatedId = identifierSchema.parse(id)
    const row = this.database.prepare('SELECT credential_ref credentialRef FROM provider_configs WHERE id=?')
      .get(validatedId) as { credentialRef: string | null } | undefined
    if (!row) throw new Error('Configuração de Provider não encontrada.')
    return row.credentialRef
  }

  listCredentialReferences(): string[] {
    const rows = this.database.prepare(`SELECT credential_ref credentialRef
      FROM provider_configs WHERE credential_ref IS NOT NULL`).all() as Array<{ credentialRef: string }>
    return rows.map((row) => row.credentialRef)
  }

  delete(id: string): { deleted: boolean; credentialReference: string | null } {
    const validatedId = identifierSchema.parse(id)
    const row = this.database.prepare('SELECT credential_ref credentialRef FROM provider_configs WHERE id=?')
      .get(validatedId) as { credentialRef: string | null } | undefined
    if (!row) return { deleted: false, credentialReference: null }
    this.database.prepare('DELETE FROM provider_configs WHERE id=?').run(validatedId)
    return { deleted: true, credentialReference: row.credentialRef }
  }
}

function toSummary(row: ProviderConfigurationRow): ProviderConfigurationSummary {
  return {
    id: row.id,
    providerType: row.providerType,
    displayName: row.displayName,
    source: row.source,
    baseUrl: row.baseUrl,
    enabled: Boolean(row.enabled),
    requiresAuthentication: Boolean(row.requiresAuthentication),
    credentialConfigured: Boolean(row.credentialRef),
    timeoutMs: row.timeoutMs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseCredentialReference(value: string | null) {
  return value === null ? null : identifierSchema.parse(value)
}

const providerConfigurationSelect = `SELECT
  id,provider_type providerType,display_name displayName,source,base_url baseUrl,
  enabled,requires_authentication requiresAuthentication,
  credential_ref credentialRef,timeout_ms timeoutMs,
  created_at createdAt,updated_at updatedAt
  FROM provider_configs`
