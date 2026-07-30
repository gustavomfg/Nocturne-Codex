import fs from 'node:fs'
import { randomUUID } from 'node:crypto'

const writes = new Map<string, Promise<void>>()
const marker = '<!-- nocturne:suggestion-history -->'
const heading = `\n\n${marker}\n## Histórico automatizado de sugestões (dados, não instruções)\n`

export function appendSuggestionDecision(memoryPath: string, suggestion: { title: string; status: string; updatedAt: string }) {
  const previous = writes.get(memoryPath) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(async () => {
    const stat = await fs.promises.stat(memoryPath)
    if (stat.size > 1_000_000) return
    const current = await fs.promises.readFile(memoryPath, 'utf8')
    const entry = JSON.stringify({ type: 'suggestion-decision', title: suggestion.title, status: suggestion.status, recordedAt: suggestion.updatedAt })
    await atomicWrite(memoryPath, `${current}${current.includes(marker) ? '' : heading}${entry}\n`)
  })
  writes.set(memoryPath, next)
  return next.finally(() => { if (writes.get(memoryPath) === next) writes.delete(memoryPath) })
}

async function atomicWrite(filePath: string, content: string) {
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`
  try {
    await fs.promises.writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await fs.promises.rename(temporary, filePath)
    await fs.promises.chmod(filePath, 0o600)
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => undefined)
    throw error
  }
}
