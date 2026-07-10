# Nocturne Codex

Cliente desktop local e independente para o Codex CLI/App Server. Reúne conversas persistentes por projeto, streaming, planos, atividades, artefatos, memória de workspace, Git e exportação de documentos em uma interface Electron.

> O Nocturne Codex é um projeto independente e não é um produto oficial da OpenAI. Ele reutiliza a instalação e a autenticação local do Codex CLI; não solicita nem empacota tokens.

## Capturas de tela

![Janela principal do Nocturne Codex](docs/images/main-window-placeholder.png)

_Placeholder: substitua por uma captura atual antes de uma release pública._

## Funcionalidades

- threads reais do Codex com streaming, cancelamento, aprovações e reconexão;
- máquina de estados central do agente e diagnóstico de processo;
- workspaces recentes/favoritos e memória em `.nocturne/`;
- atividades humanas, planos editáveis e artefatos com preview;
- status/diff/commit Git e exportação MD, HTML, DOCX e PDF;
- SQLite versionado, backup pré-migração e exportação/importação JSON;
- logs estruturados rotativos com redação de dados sensíveis;
- onboarding local e atalhos de teclado.

## Requisitos

- Node.js 20+ e npm;
- Codex CLI instalado e autenticado;
- toolchain nativa para `better-sqlite3`;
- Pandoc opcional para HTML/DOCX/PDF.

## Instalação e desenvolvimento

```bash
npm ci
npm run dev
```

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run package
```

`npm run package` produz AppImage e tar.gz em `release/<versão>/` no Linux. O Codex CLI e a autenticação do usuário não são incluídos.

## Segurança

O renderer não acessa Node.js. IPC é limitado pelo preload e validado no processo principal. Caminhos são confinados ao workspace, comandos sensíveis são classificados e aprovações ficam auditadas localmente. Ainda assim, revise todo comando antes de aprová-lo e use `read-only` para trabalhos de análise.

## Limitações

- o App Server é uma API experimental e pode mudar entre versões do Codex;
- PDF depende de uma engine compatível usada pelo Pandoc;
- recuperação reconecta a thread, mas não retoma um turno perdido no meio;
- preview interno de DOCX/PDF ainda não está disponível;
- `better-sqlite3` precisa ser reconstruído para Node ao testar e para Electron ao empacotar.

## Roadmap

- teste end-to-end com Electron/Playwright;
- atualização automática assinada;
- diff por hunk e geração dedicada de mensagem de commit;
- matriz de compatibilidade de versões do App Server.

Veja [arquitetura](docs/architecture.md), [segurança](docs/security.md), [desenvolvimento](docs/development.md) e [solução de problemas](docs/troubleshooting.md).
