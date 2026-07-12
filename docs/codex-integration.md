# Integração com Codex

## Matriz de compatibilidade

- Versão mínima: Codex CLI `0.144.0`.
- Versões verificadas: `0.144.1`.
- Requisito de protocolo: suporte a `app-server --stdio` e à API experimental utilizada pelos fluxos `initialize`, `thread/*`, `turn/*` e aprovações.

O onboarding valida a versão instalada antes de indicar que a integração está pronta. Versões mais novas podem funcionar, mas entram como compatíveis ainda não verificadas até passarem pelo smoke de contrato.

O executável configurado inicia com `app-server --stdio`. A aplicação envia `initialize`, `thread/start` ou `thread/resume` e `turn/start`. Deltas de mensagem, plano, comandos e patches são encaminhados ao renderer. `turn/interrupt` cancela o turno conhecido.

A autenticação pertence ao Codex CLI instalado no sistema. Tokens e credenciais não passam pelo preload. Em queda inesperada, chamadas pendentes são rejeitadas e uma reconexão com backoff é tentada quando não há encerramento intencional.

O App Server é experimental: incompatibilidades devem aparecer como falha, nunca como estado pronto.
