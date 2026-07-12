import { describe, expect, it } from 'vitest'
import { parsePorcelainZ, resolveSelectedGitFiles } from '../electron/ipc/registerGitIpc'

describe('git status porcelain -z', () => {
  it('preserva espaços, Unicode, aspas e quebras de linha', () => {
    const output = [' M arquivo com espaço.ts', '?? 日本語.md', '?? "aspas".txt', '?? linha\nnova.md', ''].join('\0')
    expect(parsePorcelainZ(output).map((item) => item.path)).toEqual(['arquivo com espaço.ts', '日本語.md', '"aspas".txt', 'linha\nnova.md'])
  })

  it('associa o caminho original em renomeações sem heurística textual', () => {
    expect(parsePorcelainZ(`R  novo nome.ts\0nome antigo.ts\0`)).toEqual([{ status: 'R', path: 'novo nome.ts', originalPath: 'nome antigo.ts' }])
  })
})

describe('resolveSelectedGitFiles', () => {
  const files = [{ path: 'src/a.ts' }, { path: 'src/new.ts', originalPath: 'src/old.ts' }]

  it('mantém somente a seleção explícita e inclui a origem de renomes', () => {
    expect(resolveSelectedGitFiles(files, ['src/new.ts'])).toEqual(['src/new.ts', 'src/old.ts'])
  })

  it('rejeita seleção vazia para nunca transformar git add em global', () => {
    expect(() => resolveSelectedGitFiles(files, [])).toThrow('Selecione ao menos um arquivo')
  })

  it('rejeita arquivos que desapareceram desde a última atualização', () => {
    expect(() => resolveSelectedGitFiles(files, ['removed.ts'])).toThrow('seleção do Git ficou desatualizada')
  })
})
