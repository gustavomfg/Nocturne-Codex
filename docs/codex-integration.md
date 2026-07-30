# Integração Codex CLI

O Nocturne Studio é compatível com o Codex CLI.

Compatibilidade mínima: 0.145.0.

Versões verificadas: 0.145.0 e 0.146.0.

## Verificação

O contrato de compatibilidade é validado pelo smoke test:
`npm run smoke:codex`.

## Modelos da conta ChatGPT

Após autenticar pelo Codex CLI, o Nocturne consulta `model/list` no App Server
e apresenta somente os modelos visíveis disponibilizados para aquela conta.
A escolha é persistida nas configurações locais e enviada explicitamente em
`thread/start` e `turn/start`.

Essa seleção pertence ao acesso por conta ChatGPT. Providers OpenAI-compatible
continuam usando chave de API, catálogo e cobrança separados.
