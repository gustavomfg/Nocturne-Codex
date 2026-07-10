# Desenvolvimento

Use Node.js 20+.

```bash
npm ci
npm rebuild better-sqlite3
npm run typecheck
npm run lint
npm test
npm run build
```

O postinstall prepara o módulo nativo para Electron. Para testes Vitest no Node, `npm rebuild better-sqlite3` recompila para o ABI do Node. Antes do empacotamento, o electron-builder executa a reconstrução para Electron.

Testes não chamam o Codex real. `SimulatedAppServerTransport` fornece thread, streaming e conclusão determinísticos.
