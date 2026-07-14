import fs from 'node:fs'

const files = ['src/styles/components.css', 'src/domains/suggestions/suggestions.css']
const allowedBreakpoints = new Set([520, 720, 980, 981, 1120, 1320])
const failures = []

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/@media\s*\([^)]*width\s*[<>]?=\s*(\d+)px[^)]*\)/g)) {
    const width = Number(match[1])
    if (!allowedBreakpoints.has(width)) failures.push(`${file}: breakpoint não canônico de ${width}px`)
  }
  for (const match of source.matchAll(/font(?:-size)?\s*:\s*(\d+(?:\.\d+)?)px/g)) {
    const size = Number(match[1])
    if (size < 13) failures.push(`${file}: tipografia de ${size}px abaixo do piso de 13px`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Design system consistente: tipografia >= 13px e breakpoints canônicos.')
}
