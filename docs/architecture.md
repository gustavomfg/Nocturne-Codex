# Arquitetura

O processo principal Electron é a fronteira de confiança. Ele gerencia SQLite, filesystem, Git, Pandoc e o processo filho `codex app-server --stdio`. O preload expõe somente operações nomeadas; o renderer React não possui acesso direto ao Node.js.

`CodexClient` associa requests JSON-RPC a responses por `id`, encaminha notificações e mantém threads/turnos. `AgentStateMachine` é a fonte única para o estado operacional. `LocalDatabase` persiste workspaces, conversas, mensagens, artefatos, memória, configurações e auditoria de aprovações.

Dados ficam em `app.getPath('userData')`; logs ficam em `app.getPath('logs')`. Contexto versionável do projeto fica em `<workspace>/.nocturne/`.
