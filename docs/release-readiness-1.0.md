# Prontidão da release 1.0

Esta matriz acompanha a implementação dos planos 1.0 sem confundir código
concluído com uma publicação efetivamente assinada. A versão atual continua
`0.9.5-beta`.

## Jornadas automatizadas

| Jornada | Cobertura |
| --- | --- |
| Primeiro uso | onboarding concluído e decisão persistida em `tests/renderer/renderer.spec.ts` |
| Workspace | autorização, relocalização, mudança externa e isolamento após restore em `tests/renderer/renderer.spec.ts` e `tests/workspaceTrust.test.ts` |
| Conversa | envio, streaming, paginação, retomada e erro recuperável em `tests/renderer/renderer.spec.ts`, `tests/turnPersistence.test.ts` e `tests/codexClient.test.ts` |
| Review | extração, reconciliação, evidência, histórico e decisão em `tests/suggestions.test.ts`, `tests/database.test.ts` e `tests/renderer/renderer.spec.ts` |
| Build | aprovação, limites de escrita, progresso, cancelamento e rollback em `tests/codexClient.test.ts`, `tests/buildRollbackService.test.ts` e `tests/renderer/renderer.spec.ts` |
| Docs | preview, concorrência, aplicação incremental e escrita atômica em `tests/documentUpdateService.test.ts` e `tests/renderer/renderer.spec.ts` |
| Atualização | consentimento, notas, progresso, retomada e instalação em `tests/updateService.test.ts` |
| Recuperação | banco, migração, backup parcial e workspace restaurado em `tests/databaseRecovery.test.ts`, `tests/database.test.ts`, `tests/backupSchemas.test.ts` e `tests/electronBoundaries.e2e.test.ts` |
| Instalação | pacote real exercitado por `scripts/smoke-package.mjs` em Linux, Windows e macOS no workflow `package-validation.yml` |

## Gates locais

- typecheck;
- lint e design system;
- 273 testes Vitest;
- build do renderer, main e preload;
- regressão funcional e visual Playwright;
- pacote unpacked e smoke de segurança no sistema local;
- metadados de release consistentes.

## Gates externos obrigatórios

Os itens abaixo só podem ser marcados como concluídos por uma execução do
GitHub Actions sobre a tag candidata:

- pacote e smoke nas três plataformas;
- assinatura Windows;
- assinatura e notarização macOS;
- checksums das três plataformas e assinatura GPG Linux;
- smoke autenticado do contrato Codex no commit exato;
- inventário combinado verificado;
- publicação pelo environment protegido `stable-release`.

Uma build local não satisfaz esses gates e não deve ser anunciada como release
estável.

## Bloqueio atual de publicação

A publicação 1.0 permanece bloqueada enquanto:

- `package.json` estiver em `0.9.5-beta`;
- não existir uma tag estável correspondente;
- os gates externos acima não tiverem sido executados com sucesso.

Isso não bloqueia a conclusão das melhorias de estabilização; impede somente
afirmar que a release 1.0 foi assinada, validada e publicada.
