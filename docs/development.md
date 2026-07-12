# Desenvolvimento

## Compatibilidade do Codex CLI

O desenvolvimento e os testes de contrato usam Codex CLI `0.144.1`; a versão mínima suportada é `0.144.0`. Ao atualizar o CLI, execute o smoke do pacote e registre a nova versão verificada em `shared/constants.ts` e `docs/codex-integration.md`.

Use Node.js 22 LTS.

```bash
npm ci
npm rebuild better-sqlite3
npm run typecheck
npm run lint
npm test
npm run build
```

O postinstall prepara o módulo nativo para Electron. Os testes executam Vitest com `ELECTRON_RUN_AS_NODE`, evitando sobrescrever o addon nativo usado por uma instância aberta.

Testes não chamam o Codex real. `SimulatedAppServerTransport` fornece thread, streaming e conclusão determinísticos.
