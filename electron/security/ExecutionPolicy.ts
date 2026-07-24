import path from 'node:path'
import fs from 'node:fs'

export type CommandRisk = 'safe' | 'sensitive' | 'dangerous'
export interface CommandAssessment { risk: CommandRisk; reasons: string[]; requiresApproval: boolean; blockedAutomatic: boolean }

const dangerousPrograms = new Set(['sudo', 'doas', 'su'])
const destructiveGit = new Set(['push', 'clean', 'reset'])

export function assessCommand(command: string | string[]): CommandAssessment {
  const tokens = Array.isArray(command) ? command : tokenize(command)
  const normalized = tokens.map((token) => token.toLowerCase())
  const reasons: string[] = []
  let risk: CommandRisk = 'safe'
  if (normalized.some((token) => dangerousPrograms.has(path.basename(token)))) reasons.push('Elevação de privilégios')
  const gitIndex = normalized.findIndex((token) => path.basename(token) === 'git')
  if (gitIndex >= 0 && destructiveGit.has(normalized[gitIndex + 1])) reasons.push(`Operação Git sensível: ${normalized[gitIndex + 1]}`)
  if (normalized.some((token) => path.basename(token) === 'rm') && normalized.some((token) => /^-[a-z]*r[a-z]*f|^-[a-z]*f[a-z]*r/.test(token))) reasons.push('Remoção recursiva forçada')
  if (normalized.some((token) => ['mkfs', 'shutdown', 'reboot'].includes(path.basename(token)))) reasons.push('Comando destrutivo do sistema')
  if (normalized.some((token) => ['electron-rebuild', 'electron-builder'].includes(path.basename(token))) || normalized.some((token, index) => token === 'npm' && ['rebuild', 'package'].includes(normalized[index + 1])) || normalized.some((token) => ['rebuild:native', 'package'].includes(token))) reasons.push('Pode substituir módulos nativos enquanto o aplicativo está em execução')
  if (reasons.length) risk = 'dangerous'
  else if (normalized.some((token) => ['rm', 'mv', 'chmod', 'chown'].includes(path.basename(token))) || gitIndex >= 0) risk = 'sensitive'
  return { risk, reasons, requiresApproval: risk !== 'safe', blockedAutomatic: risk === 'dangerous' }
}

const DEVICE_PATH_PREFIX = /^\\\\[?.]\\|^\/\//i

export function resolveInsideWorkspace(candidate: string, workspace: string) {
  if (typeof candidate !== 'string' || candidate.includes('\0')) {
    throw new Error('Acesso bloqueado: caminho inválido.')
  }
  if (DEVICE_PATH_PREFIX.test(candidate) || DEVICE_PATH_PREFIX.test(workspace)) {
    throw new Error('Acesso bloqueado: caminhos de dispositivo não são permitidos.')
  }
  const root = path.resolve(workspace)
  const resolved = path.resolve(root, candidate)
  assertContained(resolved, root)
  const realRoot = fs.realpathSync.native(root)
  let existing = resolved
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    existing = parent
  }
  const realExisting = fs.realpathSync.native(existing)
  assertContained(realExisting, realRoot)
  return resolved
}

function assertContained(candidate: string, root: string) {
  const relative = path.relative(root, candidate)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Acesso bloqueado: o caminho está fora do workspace.')
  }
}

function tokenize(command: string) {
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((token) => token.replace(/^(['"])(.*)\1$/, '$2')) ?? []
}
