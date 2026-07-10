import { EventEmitter } from 'node:events'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import type { RpcMessage } from './protocol'

export class CodexProcess extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private stopping = false

  start() {
    if (this.child) return
    this.stopping = false
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
    this.child.on('exit', (code, signal) => {
      this.child = null
      this.emit('exit', code, signal, this.stopping)
      this.stopping = false
    })
  }

  send(message: RpcMessage) {
    if (!this.child?.stdin.writable) throw new Error('Codex App Server não está disponível.')
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  stop() {
    if (!this.child) return
    this.stopping = true
    this.child.kill('SIGTERM')
  }

  isRunning() { return Boolean(this.child && !this.child.killed) }
}
