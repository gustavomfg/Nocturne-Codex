import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const releaseDirectory = path.join(root, 'release', pkg.version)
const required = process.argv.includes('--require')

if (!fs.existsSync(releaseDirectory)) throw new Error(`Diretório de release não encontrado: ${releaseDirectory}`)

if (process.platform === 'darwin') verifyMac()
else if (process.platform === 'win32') verifyWindows()
else verifyLinux()

function verifyMac() {
  const app = firstExisting([
    path.join(releaseDirectory, 'mac', 'Nocturne Codex.app'),
    path.join(releaseDirectory, 'mac-arm64', 'Nocturne Codex.app'),
  ])
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' })
  execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose=2', app], { stdio: 'inherit' })
  const dmg = distributedFile('.dmg')
  execFileSync('xcrun', ['stapler', 'validate', dmg], { stdio: 'inherit' })
  process.stdout.write(`Assinatura Developer ID e notarização verificadas: ${path.basename(dmg)}\n`)
}

function verifyWindows() {
  const installer = distributedFile('.exe')
  const script = "$signature = Get-AuthenticodeSignature -LiteralPath $args[0]; if ($signature.Status -ne 'Valid') { throw \"Assinatura Authenticode inválida: $($signature.Status)\" }; Write-Output $signature.SignerCertificate.Subject"
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script, installer], { stdio: 'inherit' })
  process.stdout.write(`Assinatura Authenticode verificada: ${path.basename(installer)}\n`)
}

function verifyLinux() {
  const checksums = path.join(releaseDirectory, 'SHA256SUMS')
  if (!fs.existsSync(checksums)) throw new Error('SHA256SUMS não foi gerado.')
  execFileSync('sha256sum', ['--check', 'SHA256SUMS'], { cwd: releaseDirectory, stdio: 'inherit' })
  const signature = `${checksums}.sig`
  if (!fs.existsSync(signature)) {
    if (required) throw new Error('Assinatura destacada SHA256SUMS.sig ausente.')
    return
  }
  execFileSync('gpg', ['--batch', '--verify', signature, checksums], { stdio: 'inherit' })
  process.stdout.write('Checksums e assinatura GPG verificados.\n')
}

function distributedFile(extension) {
  const file = fs.readdirSync(releaseDirectory).find((name) => name.endsWith(extension))
  if (!file) throw new Error(`Artefato ${extension} não encontrado em ${releaseDirectory}.`)
  return path.join(releaseDirectory, file)
}

function firstExisting(candidates) {
  const result = candidates.find((candidate) => fs.existsSync(candidate))
  if (!result) throw new Error(`Aplicativo empacotado não encontrado em ${releaseDirectory}.`)
  return result
}

