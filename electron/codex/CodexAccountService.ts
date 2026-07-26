import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import compatibility from '../../shared/codex-compatibility.json'
import type { CodexAccountStatus } from '../../shared/types'

const execFileAsync = promisify(execFile)

type CommandRunner = (
  args: string[],
  timeout: number,
) => Promise<{ stdout: string; stderr: string }>

export class CodexAccountService {
  constructor(
    private readonly run: CommandRunner = (args, timeout) => execFileAsync(
      'codex',
      args,
      { encoding: 'utf8', timeout, maxBuffer: 64_000 },
    ),
  ) {}

  async status(): Promise<CodexAccountStatus> {
    let versionOutput: string
    try {
      versionOutput = (await this.run(['--version'], 5_000)).stdout
    } catch (error) {
      if (isMissingExecutable(error)) {
        return { installed: false, authenticated: false, compatible: false }
      }
      throw new Error('Não foi possível verificar a instalação do Codex CLI.')
    }

    const version = versionOutput.match(/\d+\.\d+\.\d+/)?.[0]
    const compatible = Boolean(version && compatibility.verified.includes(version))
    try {
      const output = await this.run(['login', 'status'], 10_000)
      const authenticationMethod = parseAuthenticationMethod(`${output.stdout}\n${output.stderr}`)
      return {
        installed: true,
        authenticated: authenticationMethod !== undefined,
        compatible,
        version,
        authenticationMethod,
      }
    } catch {
      return {
        installed: true,
        authenticated: false,
        compatible,
        version,
      }
    }
  }

  async login() {
    const current = await this.status()
    if (!current.installed) {
      throw new Error('Instale o Codex CLI antes de conectar sua conta ChatGPT.')
    }
    if (!current.compatible) {
      throw new Error(
        `A versão instalada do Codex CLI não foi homologada. Use uma das versões verificadas: ${compatibility.verified.join(', ')}.`,
      )
    }
    if (current.authenticated && current.authenticationMethod === 'chatgpt') return current

    try {
      await this.run(['login'], 10 * 60_000)
    } catch {
      throw new Error('O login do Codex não foi concluído. Tente novamente e finalize a autenticação no navegador.')
    }
    const authenticated = await this.status()
    if (!authenticated.authenticated || authenticated.authenticationMethod !== 'chatgpt') {
      throw new Error('O Codex CLI não confirmou uma conta ChatGPT autenticada.')
    }
    return authenticated
  }

  async logout() {
    const current = await this.status()
    if (!current.installed || !current.authenticated) return current
    try {
      await this.run(['logout'], 15_000)
    } catch {
      throw new Error('Não foi possível desconectar a conta do Codex CLI.')
    }
    return this.status()
  }
}

function parseAuthenticationMethod(output: string) {
  if (!/logged in|autenticad[oa]|signed in/i.test(output)) return undefined
  if (/chatgpt/i.test(output)) return 'chatgpt' as const
  if (/api key|api-key/i.test(output)) return 'api-key' as const
  return 'unknown' as const
}

function isMissingExecutable(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
