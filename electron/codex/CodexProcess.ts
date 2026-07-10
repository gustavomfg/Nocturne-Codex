import { EventEmitter } from 'node:events'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import type { RpcMessage } from './protocol'

export class CodexProcess extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null

  start() {
    if (this.child) return
    this.child = spawn('codex', ['app-server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    const lines = readline.createInterface({ input: this.child.stdout })
    lines.on('line', (line) => {
      try {
        this.emit('message', JSON.parse(line) as RpcMessage)
      } catch {
        this.emit('log', line)
      }
    })
    this.child.stderr.on('data', (chunk) => this.emit('log', chunk.toString()))
    this.child.on('error', (error) => this.emit('error', error))
    this.child.on('exit', (code) => {
      this.child = null
      this.emit('exit', code)
    })
  }

  send(message: RpcMessage) {
    if (!this.child?.stdin.writable) throw new Error('Codex App Server não está disponível.')
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  stop() {
    this.child?.kill('SIGTERM')
    this.child = null
  }
}

