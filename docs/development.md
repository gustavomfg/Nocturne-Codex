# Desenvolvimento

## Compatibilidade do Codex CLI

O desenvolvimento e os testes de contrato usam Codex CLI `0.144.1`; a versão mínima suportada é `0.144.0`. Ao atualizar o CLI, execute o smoke do pacote e registre a nova versão verificada em `shared/codex-compatibility.json` e `docs/codex-integration.md`.

Use Node.js 24.18 ou superior dentro da linha Node 24 LTS, com npm 11. A faixa suportada está declarada no `package.json`, o `.nvmrc` fixa o runtime mínimo verificado e o CI valida tanto esse mínimo quanto a versão atual da linha Node 24.

```bash
npm ci
npm rebuild better-sqlite3
npm run typecheck
npm run lint
npm test
npm run test:renderer
npm run build
```

O postinstall prepara o módulo nativo para Electron. Os testes executam Vitest com `ELECTRON_RUN_AS_NODE`, evitando sobrescrever o addon nativo usado por uma instância aberta.

Os testes não chamam o serviço real do Codex. `SimulatedAppServerTransport` fornece thread, streaming e conclusão determinísticos, enquanto a suíte direta do `CodexClient` injeta um adaptador de processo controlado para validar respostas JSON-RPC, aprovações, timeouts, interrupção, queda do processo e reconexão.

## Testes do renderer

O Playwright inicia somente o renderer Vite e injeta uma ponte `window.nocturne` determinística; nenhum banco, workspace ou login real é acessado. A suíte cobre painéis off-canvas, foco, Escape, tabulação modal, composer multilinha, streaming, aprovações, erros, configurações não salvas e estados vazios. As referências visuais versionadas usam os breakpoints de 1440, 980, 720 e 520 px.

Depois de uma alteração visual intencional, revise as imagens produzidas e atualize as referências com `npm run test:renderer:update`. Nunca atualize snapshots apenas para silenciar uma falha.

## Contrato real do App Server

Em uma máquina isolada com o Codex CLI autenticado, execute `npm run smoke:codex`. Esse teste é deliberadamente separado da suíte rápida: ele usa o serviço real, não altera o projeto e gera somente um relatório sanitizado. A automação equivalente usa um runner próprio e o ambiente protegido `codex-contract-smoke`; não disponibilize autenticação do Codex a workflows de pull request.

O workflow protegido também roda semanalmente e sempre que a matriz de compatibilidade ou o próprio smoke muda no `master`. O runner deve manter uma instalação controlada do CLI, autenticação exclusiva para esse teste e nenhum workspace real acessível. Cada execução conserva por 30 dias um relatório associado à versão observada.

O workflow `Package validation` valida todo push no `master`. Typecheck, lint, testes e renderer rodam sobre a fonte integrada; a matriz de empacotamento permanece restrita a pull requests relevantes, tags e execuções manuais para evitar builds de plataforma redundantes.
