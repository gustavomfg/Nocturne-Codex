import { describe, expect, it } from 'vitest'
import { parsePorcelainZ } from '../electron/ipc/registerGitIpc'

describe('git status porcelain -z', () => {
  it('preserva espaços, Unicode, aspas e quebras de linha', () => {
    const output = [' M arquivo com espaço.ts', '?? 日本語.md', '?? "aspas".txt', '?? linha\nnova.md', ''].join('\0')
    expect(parsePorcelainZ(output).map((item) => item.path)).toEqual(['arquivo com espaço.ts', '日本語.md', '"aspas".txt', 'linha\nnova.md'])
  })

  it('associa o caminho original em renomeações sem heurística textual', () => {
    expect(parsePorcelainZ(`R  novo nome.ts\0nome antigo.ts\0`)).toEqual([{ status: 'R', path: 'novo nome.ts', originalPath: 'nome antigo.ts' }])
  })
})
