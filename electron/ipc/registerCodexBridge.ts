import type { BrowserWindow } from 'electron'
import type { CodexClient } from '../codex/CodexClient'
import type { Logger } from '../logging/Logger'
import { assessCommand } from '../security/ExecutionPolicy'

export type ApprovalDetails = Map<string, { command?: string; risk?: string }>

export function registerCodexBridge(win: BrowserWindow, codex: CodexClient, logger: Logger, approvalDetails: ApprovalDetails) {
  const push = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  const onEvent = (event: { method: string; params: Record<string, unknown> }) => {
    const command = event.params.command
    const assessment = typeof command === 'string' || Array.isArray(command) ? assessCommand(command as string | string[]) : undefined
    const approvalKey = typeof event.params.approvalKey === 'string' ? event.params.approvalKey : undefined
    if (approvalKey) approvalDetails.set(approvalKey, { command: Array.isArray(command) ? command.join(' ') : typeof command === 'string' ? command : undefined, risk: assessment?.risk })
    push('codex:event', assessment ? { ...event, params: { ...event.params, commandAssessment: assessment } } : event)
  }
  const onStatus = (status: unknown) => push('codex:status', status)
  const onLog = (entry: unknown) => logger.debug('codex', 'Saída do App Server', entry)
  const onDiagnostic = (entry: unknown) => logger.warn('codex', 'Diagnóstico do agente', entry)
  codex.on('event', onEvent)
  codex.on('status', onStatus)
  codex.on('log', onLog)
  codex.on('diagnostic', onDiagnostic)
  return () => {
    codex.off('event', onEvent)
    codex.off('status', onStatus)
    codex.off('log', onLog)
    codex.off('diagnostic', onDiagnostic)
    approvalDetails.clear()
  }
}
