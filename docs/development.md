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
npm run build
```

O postinstall prepara o módulo nativo para Electron. Os testes executam Vitest com `ELECTRON_RUN_AS_NODE`, evitando sobrescrever o addon nativo usado por uma instância aberta.

Os testes não chamam o serviço real do Codex. `SimulatedAppServerTransport` fornece thread, streaming e conclusão determinísticos, enquanto a suíte direta do `CodexClient` injeta um adaptador de processo controlado para validar respostas JSON-RPC, aprovações, timeouts, interrupção, queda do processo e reconexão.
