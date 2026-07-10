import path from 'node:path'

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

export function resolveInsideWorkspace(candidate: string, workspace: string) {
  const root = path.resolve(workspace)
  const resolved = path.resolve(root, candidate)
  const relative = path.relative(root, resolved)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Acesso bloqueado: o caminho está fora do workspace.')
  return resolved
}

function tokenize(command: string) {
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((token) => token.replace(/^(['"])(.*)\1$/, '$2')) ?? []
}
