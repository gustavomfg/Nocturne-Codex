import { describe, expect, it } from 'vitest'
import { classifyCodexVersion } from '../shared/constants'

describe('compatibilidade do Codex CLI', () => {
  it('distingue versões incompatíveis, mínimas não verificadas e verificadas', () => {
    expect(classifyCodexVersion(undefined)).toBe('unsupported')
    expect(classifyCodexVersion('codex-cli 0.143.9')).toBe('unsupported')
    expect(classifyCodexVersion('codex-cli 0.144.0')).toBe('minimum-compatible-unverified')
    expect(classifyCodexVersion('codex-cli 0.144.1')).toBe('verified')
    expect(classifyCodexVersion('codex-cli 0.144.5')).toBe('verified')
    expect(classifyCodexVersion('codex-cli 0.145.0')).toBe('minimum-compatible-unverified')
  })
})
