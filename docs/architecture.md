# Arquitetura

O processo principal Electron é a fronteira de confiança. Ele gerencia SQLite, filesystem, Git, Pandoc e o processo filho `codex app-server --stdio`. O preload expõe somente operações nomeadas; o renderer React não possui acesso direto ao Node.js.

`CodexClient` associa requests JSON-RPC a responses por `id`, encaminha notificações e mantém threads/turnos. `AgentStateMachine` é a fonte única para o estado operacional. `LocalDatabase` persiste workspaces, conversas, mensagens, artefatos, memória, configurações e auditoria de aprovações.

O Intelligent Review System recebe um bloco estruturado validado com Zod no processo principal. Sugestões e decisões usam tabelas próprias; Review Mode força `readOnly` no sandbox do turno. Aplicação é um novo turno Build confirmado pelo usuário, nunca efeito de abrir uma proposta.

Dados ficam em `app.getPath('userData')`; logs ficam em `app.getPath('logs')`. Contexto versionável do projeto fica em `<workspace>/.nocturne/`.
