# Integração com Codex

O executável configurado inicia com `app-server --stdio`. A aplicação envia `initialize`, `thread/start` ou `thread/resume` e `turn/start`. Deltas de mensagem, plano, comandos e patches são encaminhados ao renderer. `turn/interrupt` cancela o turno conhecido.

A autenticação pertence ao Codex CLI instalado no sistema. Tokens e credenciais não passam pelo preload. Em queda inesperada, chamadas pendentes são rejeitadas e uma reconexão com backoff é tentada quando não há encerramento intencional.

O App Server é experimental: incompatibilidades devem aparecer como falha, nunca como estado pronto.
