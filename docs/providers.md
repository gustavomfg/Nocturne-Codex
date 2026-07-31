# Providers e modelos

## Conta ChatGPT

A conta é conectada pelo Codex CLI. O Nocturne não recebe senha ou token da
conta: ele consulta o App Server autenticado e lista somente os modelos
disponibilizados para aquela conta. Uma assinatura ChatGPT não fornece créditos
da API da OpenAI.

## APIs e modelos locais

O adapter OpenAI-compatible atende OpenAI API, OpenRouter, DeepSeek, Ollama, LM
Studio e endpoints customizados compatíveis. APIs remotas usam HTTPS; HTTP é
aceito somente em loopback para Provider local.

Cada configuração informa capacidades, limitações, autenticação, catálogo e
estado. A tela de diagnóstico diferencia conectividade, credencial, modelo,
compatibilidade, timeout e erros recentes.

Chaves são cifradas pelo armazenamento seguro do sistema operacional, nunca
retornam ao renderer e não entram em backup ou diagnóstico.

## Falhas comuns

- **Créditos insuficientes:** adicione saldo na conta da API ou selecione outro
  Provider; o plano ChatGPT não cobre chamadas de API.
- **Chave inválida:** substitua a credencial na configuração do Provider.
- **Modelo ausente:** atualize o catálogo e selecione um modelo disponível.
- **Rate limit:** aguarde o período indicado pelo serviço e tente novamente.
- **Endpoint inacessível:** confirme URL, TLS, serviço local e firewall.

O contrato técnico está em `docs/provider-contract.md`; a separação entre conta
e API está detalhada em `docs/provider-subscription-access.md`.
