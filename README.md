# Nocturne Codex

Cliente desktop local para o Codex App Server. Oferece conversas persistentes por projeto, respostas em streaming, visualização de atividades e diffs, e aprovação explícita de comandos e alterações de arquivos.

## Requisitos

- Node.js 20+
- Codex CLI instalado e autenticado (`codex --version`)
- Toolchain nativa compatível com o Electron para o `better-sqlite3`

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação e build sem gerar instalador:

```bash
npm run typecheck
npm run build:app
```

Para gerar o instalador da plataforma atual, use `npm run build`.

## Arquitetura

- `electron/codex`: processo do App Server, transporte JSON-RPC e gerenciamento de aprovações.
- `electron/database`: banco SQLite local em `app.getPath('userData')/nocturne.db`.
- `electron/ipc`: handlers validados com Zod e acesso restrito às operações necessárias.
- `electron/preload.ts`: API mínima exposta ao renderer via `contextBridge`.
- `src`: interface React, estado Zustand e renderização Markdown.

O processo renderer não possui acesso a Node.js. O App Server inicia com `workspace-write`, `on-request` e a pasta escolhida como única raiz de runtime. Tokens não passam pelo renderer: o aplicativo reutiliza a autenticação já existente do Codex CLI.

## Escopo do MVP

- seleção de workspace e histórico local;
- criação e retomada de threads do Codex;
- streaming de mensagens e progresso do agente;
- comandos, alterações de arquivos e diff em tempo real;
- aprovação ou recusa de comandos e patches;
- persistência de conversas e mensagens em SQLite.
