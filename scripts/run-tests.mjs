import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron')
const vitest = path.join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs')

// Execute o Vitest com o Node embutido no Electron. Recompilar better-sqlite3
// enquanto o Nocturne está aberto pode sobrescrever o addon nativo mapeado e
// encerrar o processo inteiro com SIGBUS/segmentation fault.
const result = spawnSync(electron, [vitest, 'run'], { stdio: 'inherit', shell: false, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
process.exitCode = result.status ?? 1
