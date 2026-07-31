# Contrato de Providers

Todo adapter registrado no Nocturne Studio declara o mesmo contrato interno:

- identidade, origem, protocolo e versão quando disponível;
- descoberta de modelos;
- suporte a streaming, ferramentas e cancelamento;
- modo de autenticação;
- limites de timeout e limitações conhecidas;
- disponibilidade normalizada;
- execução com `AbortSignal` e eventos de streaming normalizados.

O diagnóstico mede a latência da verificação, separa conectividade,
autenticação e compatibilidade e mantém até cinco erros recentes sanitizados
por Provider durante a sessão. Credenciais, respostas nativas e payloads não
entram no diagnóstico.

O adapter OpenAI-compatible oferece descoberta de modelos, streaming e
cancelamento. Tool calling ainda não é normalizado e aparece explicitamente
como limitação. Falhas HTTP e de protocolo são convertidas em códigos comuns:
autenticação recusada, créditos insuficientes, rate limit, modelo indisponível,
Provider inacessível, resposta inválida, timeout e cancelamento.
