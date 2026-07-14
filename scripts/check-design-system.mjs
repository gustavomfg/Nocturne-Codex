import fs from 'node:fs'
import postcss from 'postcss'

const files = ['src/styles/components.css', 'src/domains/suggestions/suggestions.css']
const allowedBreakpoints = new Set([520, 720, 980, 981, 1120, 1320])
const failures = []

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/@media\s*\([^)]*(?:min-|max-)?width\s*(?::|[<>]?=)\s*(\d+)px[^)]*\)/g)) {
    const width = Number(match[1])
    if (!allowedBreakpoints.has(width)) failures.push(`${file}: breakpoint não canônico de ${width}px`)
  }
  for (const match of source.matchAll(/font(?:-size)?\s*:\s*(\d+(?:\.\d+)?)px/g)) {
    const size = Number(match[1])
    if (size < 13) failures.push(`${file}: tipografia de ${size}px abaixo do piso de 13px`)
  }
  const root = postcss.parse(source, { from: file })
  auditShadowedDeclarations(root, file)
}

function auditShadowedDeclarations(container, file) {
  const selectors = new Map()
  for (const node of container.nodes ?? []) {
    if (node.type === 'rule') selectors.set(node.selector, [...(selectors.get(node.selector) ?? []), node])
    if (node.type === 'atrule') auditShadowedDeclarations(node, file)
  }
  for (const [selector, rules] of selectors) {
    const seen = new Map()
    for (const rule of [...rules].reverse()) {
      for (const declaration of [...rule.nodes].reverse()) {
        if (declaration.type !== 'decl') continue
        const later = seen.get(declaration.prop)
        if (later && (!declaration.important || later.important)) failures.push(`${file}:${declaration.source.start.line}: ${declaration.prop} é sobrescrita por uma regra posterior idêntica (${selector})`)
        else if (!later || declaration.important) seen.set(declaration.prop, declaration)
      }
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Design system consistente: tipografia >= 13px, breakpoints canônicos e nenhuma declaração idêntica sombreada.')
}
