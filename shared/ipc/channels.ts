export const IPC_CHANNELS = {
  workspace: { select: 'workspace:select', validate: 'workspace:validate', list: 'workspaces:list', remove: 'workspaces:remove', favorite: 'workspaces:favorite', openTool: 'workspace:openTool' },
  conversations: { list: 'conversations:list', create: 'conversations:create', messages: 'conversations:messages', delete: 'conversations:delete' },
  codex: { start: 'codex:start', restart: 'codex:restart', diagnostics: 'codex:diagnostics', send: 'codex:send', resume: 'codex:resume', interrupt: 'codex:interrupt', saveAssistant: 'codex:save-assistant', approve: 'codex:approve', event: 'codex:event', status: 'codex:status' },
  files: { attach: 'files:attach', open: 'files:open', preview: 'files:preview' },
  memory: { get: 'memory:get', set: 'memory:set' },
  artifacts: { list: 'artifacts:list', delete: 'artifacts:delete' },
  suggestions: { list: 'suggestions:list', create: 'suggestions:create', status: 'suggestions:status' },
  data: { export: 'data:export', import: 'data:import' },
  diagnostics: { openLogs: 'diagnostics:openLogs', copy: 'diagnostics:copy', rendererError: 'diagnostics:rendererError', rendererStats: 'diagnostics:rendererStats' },
  settings: { get: 'settings:get', set: 'settings:set' },
  git: { status: 'git:status', commit: 'git:commit' },
  documents: { saveMarkdown: 'documents:saveMarkdown', export: 'documents:export' },
} as const

