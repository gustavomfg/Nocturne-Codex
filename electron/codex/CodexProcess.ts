import { EventEmitter } from 'node:events'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import type { RpcMessage } from './protocol'
import { parseRpcLine } from './RpcTransport'

export class CodexProcess extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private stopping = false

  private executable = 'codex'

  start(executable = this.executable) {
    if (this.child) return
    this.executable = executable
    this.stopping = false
    this.child = spawn(executable, ['app-server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    const lines = readline.createInterface({ input: this.child.stdout })
    lines.on('line', (line) => {
      const message = parseRpcLine(line)
      if (message) this.emit('message', message)
      else this.emit('stdout', line)
    })
    this.child.stderr.on('data', (chunk) => this.emit('stderr', chunk.toString()))
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
    const child = this.child
    setTimeout(() => { if (this.child === child && !child.killed) child.kill('SIGKILL') }, 3_000).unref()
  }

  isRunning() { return Boolean(this.child && !this.child.killed) }
  get pid() { return this.child?.pid ?? null }
  get path() { return this.executable }
}
