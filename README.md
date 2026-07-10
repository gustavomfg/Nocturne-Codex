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

- múltiplos workspaces com conversas separadas e histórico SQLite;
- criação, retomada (`thread/resume`) e continuidade de threads reais do Codex;
- streaming, cancelamento de turnos e reconexão do App Server;
- atividades de raciocínio, ferramentas, comandos, alterações, erros e conclusão;
- aprovação ou recusa de comandos e patches;
- arquivos alterados, abertura pelo sistema e diff do Codex/Git;
- anexos de texto locais limitados ao workspace e a 1 MB por arquivo;
- atalhos para análise, documentação e revisão Git;
- salvamento Markdown e exportação HTML, DOCX ou PDF com Pandoc;
- configurações de modelo, sandbox e política de aprovação;
- status/branch/diff Git e criação confirmada de commits.

## Dependências opcionais

O Pandoc precisa estar disponível no `PATH` para exportar HTML, DOCX e PDF. A geração de PDF também depende de um mecanismo PDF compatível instalado no sistema. Quando uma dependência externa falha, a mensagem original é exibida na interface.

## Segurança operacional

Arquivos anexados e abertos são validados contra a raiz do workspace. Comandos do Codex seguem a política escolhida e, por padrão, usam `workspace-write` com rede desabilitada. A criação de commit exige confirmação e inclui um `git add -A`; o aplicativo não executa push. Exclusão de conversas remove apenas o histórico local do Nocturne.
