# Integração com Codex

## Matriz de compatibilidade

- Versão mínima: Codex CLI `0.144.0`.
- Versões verificadas: `0.144.1` e `0.144.5`.
- Requisito de protocolo: suporte a `app-server --stdio` e à API experimental utilizada pelos fluxos `initialize`, `thread/*`, `turn/*` e aprovações.

O onboarding valida a versão instalada antes de indicar que a integração está pronta. Versões mais novas podem funcionar, mas entram como compatíveis ainda não verificadas até passarem pelo smoke de contrato.

O diagnóstico expõe três estados distintos:

- `unsupported`: versão ausente, ilegível ou abaixo de `0.144.0`;
- `minimum-compatible-unverified`: atende ao mínimo, mas não consta na matriz homologada;
- `verified`: consta explicitamente em `shared/codex-compatibility.json`.

O booleano legado `codexCompatible` permanece no contrato para compatibilidade da interface, mas somente `verified` significa homologação pelo projeto.

O executável configurado inicia com `app-server --stdio`. A aplicação envia `initialize`, `thread/start` ou `thread/resume` e `turn/start`. Deltas de mensagem, plano, comandos e patches são encaminhados ao renderer. `turn/interrupt` cancela o turno conhecido.

Antes de cada `turn/start`, o processo principal busca no Segundo Cérebro somente memórias ativas que correspondam ao prompt e pertençam ao workspace ou à conversa atual. Até oito entradas e 6.000 caracteres são anexados ao contexto dinâmico como linhas JSON explicitamente classificadas como dados potencialmente desatualizados, nunca como instruções. O contador de uso só avança depois que o turno é aceito pelo App Server.

A autenticação pertence ao Codex CLI instalado no sistema. Tokens e credenciais não passam pelo preload. Em queda inesperada, chamadas pendentes são rejeitadas e uma reconexão com backoff é tentada quando não há encerramento intencional.

O App Server é experimental: incompatibilidades devem aparecer como falha, nunca como estado pronto.

## Smoke contra o CLI real

`npm run smoke:codex` é opt-in e exige uma instalação autenticada do Codex CLI. Ele cria um workspace temporário, inicializa `app-server --stdio`, valida `config/read`, `thread/start`, `turn/start` e `turn/interrupt`, usa sandbox somente leitura e recusa qualquer solicitação de aprovação. O processo é encerrado e o workspace removido mesmo em falha.

O relatório `test-results/codex-contract-smoke.json` contém apenas versão, etapas booleanas e contadores; prompts, respostas, configuração e credenciais não são preservados. O workflow protegido `Codex CLI contract smoke` roda semanalmente, quando a matriz ou o teste muda no `master`, por execução manual e antes de cada release. O checklist de publicação deve exigir um resultado recente e bem-sucedido para a versão declarada como verificada.
