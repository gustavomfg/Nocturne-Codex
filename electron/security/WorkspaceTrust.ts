import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const systemRoots = process.platform === 'win32'
  ? [process.env.SystemRoot, process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
  : ['/bin', '/boot', '/dev', '/etc', '/proc', '/run', '/sbin', '/sys', '/usr', '/var']

export function assertSafeWorkspaceScope(value: string, requireExisting = true) {
  const resolved = path.resolve(value)
  const candidate = fs.existsSync(resolved) ? fs.realpathSync.native(resolved) : resolved
  const blocked = [path.parse(candidate).root, os.homedir(), ...systemRoots]
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => path.resolve(entry))
  if (blocked.includes(candidate)) throw new Error('Selecione uma pasta de projeto específica; raízes amplas e diretórios do sistema não são permitidos.')
  if (requireExisting && (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory())) throw new Error('Workspace não encontrado.')
  return candidate
}
