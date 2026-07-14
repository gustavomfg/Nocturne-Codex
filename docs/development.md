# Desenvolvimento

## Compatibilidade do Codex CLI

O desenvolvimento e os testes de contrato usam Codex CLI `0.144.1`; a versão mínima suportada é `0.144.0`. Ao atualizar o CLI, execute o smoke do pacote e registre a nova versão verificada em `shared/constants.ts` e `docs/codex-integration.md`.

Use Node.js 22.12 ou superior dentro da linha Node 22 LTS, com npm 10. A faixa suportada está declarada no `package.json`, o `.nvmrc` fixa o runtime mínimo verificado e o CI valida tanto esse mínimo quanto a versão atual da linha Node 22.

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
