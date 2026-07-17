# Desenvolvimento

## Compatibilidade do Codex CLI

O desenvolvimento e os testes de contrato usam Codex CLI `0.144.1` e `0.144.5`; a versão mínima suportada é `0.144.0`. Uma versão no mínimo, mas ausente da matriz, permanece `minimum-compatible-unverified` até homologação; somente entradas explícitas são `verified`. Ao atualizar o CLI, execute o smoke do pacote e registre a nova versão verificada em `shared/codex-compatibility.json` e `docs/codex-integration.md`.

O WebStorm é a IDE adotada pelo projeto. Mantenha o launcher `webstorm` disponível no `PATH` para que o atalho de abertura do workspace funcione; a pasta `.idea` permanece local e não deve ser versionada.

Use Node.js 24.18 ou superior dentro da linha Node 24 LTS, com npm 11. A faixa suportada está declarada no `package.json`, o `.nvmrc` fixa o runtime mínimo verificado e o CI valida tanto esse mínimo quanto a versão atual da linha Node 24.

```bash
npm ci
npm run rebuild:native
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

O workflow `Dependency security` roda semanalmente, por execução manual e em pull requests que alteram `package.json` ou `package-lock.json`. Ele instala exatamente o lockfile sem executar scripts, bloqueia vulnerabilidades de severidade alta ou crítica nas dependências de produção e publica por 30 dias um SBOM CycloneDX associado ao commit analisado.

## Orçamentos de persistência

A suíte de release mede dois cenários canônicos definidos em `shared/ipc/backupLimits.ts`: restauração SQLite de 25 mil mensagens em até 2 segundos, seguida da primeira página em até 100 ms; e round-trip de serialização, escrita e parsing em worker com 50.001 registros em até 2 segundos. Esses números são orçamentos de regressão para cargas representativas no ambiente de CI, não garantias para o limite agregado de 200 mil registros ou 25 MB.

Exportação e importação registram duração, bytes ou quantidade de registros nos logs sanitizados. Ao alterar schemas, statements ou limites, compare essas métricas e ajuste o cenário somente com medição documentada; não eleve o orçamento apenas para acomodar uma regressão.
