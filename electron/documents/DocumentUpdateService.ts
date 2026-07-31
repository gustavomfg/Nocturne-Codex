import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { resolveInsideWorkspace } from '../security/ExecutionPolicy'

const MAX_DOCUMENT_BYTES = 2_000_000

export type DocumentUpdateStrategy = 'append' | 'replace'

export interface DocumentUpdatePreview {
  target: string
  name: string
  existing: string
  generated: string
  expectedHash: string | null
}

export class DocumentUpdateService {
  async preview(workspace: string, target: string, generated: string): Promise<DocumentUpdatePreview> {
    const resolved = resolveDocumentTarget(workspace, target)
    const stat = await fs.promises.stat(resolved).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (stat && !stat.isFile()) throw new Error('O destino da documentação não é um arquivo.')
    if (stat && stat.size > MAX_DOCUMENT_BYTES) throw new Error('Documentação existente excede o limite de 2 MB.')
    const existing = stat ? await fs.promises.readFile(resolved, 'utf8') : ''
    return {
      target: resolved,
      name: path.basename(resolved),
      existing,
      generated,
      expectedHash: stat ? digest(existing) : null,
    }
  }

  async apply(
    workspace: string,
    target: string,
    generated: string,
    strategy: DocumentUpdateStrategy,
    expectedHash: string | null,
  ) {
    const current = await this.preview(workspace, target, generated)
    if (current.expectedHash !== expectedHash) {
      throw new Error('O documento mudou depois do preview. Gere uma nova comparação antes de aplicar.')
    }
    const content = mergeMarkdown(current.existing, generated, strategy)
    const temporary = `${current.target}.tmp-${process.pid}-${randomUUID()}`
    let handle: fs.promises.FileHandle | null = null
    try {
      handle = await fs.promises.open(temporary, 'wx', 0o600)
      await handle.writeFile(content, 'utf8')
      await handle.sync()
      await handle.close()
      handle = null
      await fs.promises.rename(temporary, current.target)
      await fs.promises.chmod(current.target, 0o600)
    } catch (error) {
      await handle?.close().catch(() => undefined)
      await fs.promises.unlink(temporary).catch(() => undefined)
      throw error
    }
    return { target: current.target, content, strategy }
  }
}

export function mergeMarkdown(existing: string, generated: string, strategy: DocumentUpdateStrategy) {
  const normalized = generated.trim()
  if (strategy === 'replace' || !existing.trim()) return `${normalized}\n`
  return `${existing.trimEnd()}\n\n${normalized}\n`
}

function resolveDocumentTarget(workspace: string, target: string) {
  const resolved = resolveInsideWorkspace(target, workspace)
  if (path.extname(resolved).toLowerCase() !== '.md') {
    throw new Error('Docs Mode só aplica atualizações incrementais em arquivos Markdown.')
  }
  return resolved
}

function digest(content: string) {
  return createHash('sha256').update(content).digest('hex')
}
