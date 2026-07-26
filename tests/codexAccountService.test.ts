import { describe, expect, it, vi } from 'vitest'
import { CodexAccountService } from '../electron/codex/CodexAccountService'

describe('CodexAccountService', () => {
  it('distingue login ChatGPT da autenticação por API key', async () => {
    const chatGpt = new CodexAccountService(async (args) => ({
      stdout: args[0] === '--version'
        ? 'codex-cli 0.145.0'
        : 'Logged in using ChatGPT',
      stderr: '',
    }))
    await expect(chatGpt.status()).resolves.toEqual({
      installed: true,
      authenticated: true,
      compatible: true,
      version: '0.145.0',
      authenticationMethod: 'chatgpt',
    })

    const apiKey = new CodexAccountService(async (args) => ({
      stdout: args[0] === '--version'
        ? 'codex-cli 0.145.0'
        : 'Logged in using an API key',
      stderr: '',
    }))
    await expect(apiKey.status()).resolves.toMatchObject({
      authenticated: true,
      authenticationMethod: 'api-key',
    })
  })

  it('executa o login no navegador e confirma a conta antes de concluir', async () => {
    let authenticated = false
    const run = vi.fn(async (args: string[]) => {
      if (args[0] === '--version') return { stdout: 'codex-cli 0.145.0', stderr: '' }
      if (args[0] === 'login' && args[1] === 'status') {
        if (!authenticated) throw new Error('Not logged in')
        return { stdout: 'Logged in using ChatGPT', stderr: '' }
      }
      authenticated = true
      return { stdout: '', stderr: '' }
    })
    const service = new CodexAccountService(run)
    await expect(service.login()).resolves.toMatchObject({
      authenticated: true,
      authenticationMethod: 'chatgpt',
    })
    expect(run).toHaveBeenCalledWith(['login'], 600_000)
  })

  it('falha fechado para versão não homologada', async () => {
    const service = new CodexAccountService(async (args) => ({
      stdout: args[0] === '--version'
        ? 'codex-cli 9.9.9'
        : 'Logged in using ChatGPT',
      stderr: '',
    }))
    await expect(service.login()).rejects.toThrow(/não foi homologada/)
  })
})
