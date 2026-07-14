# Política de Segurança

Não abra uma issue pública para vulnerabilidades.

Use o canal privado de security advisories do GitHub deste repositório. Inclua versão, plataforma, impacto, reprodução mínima e possíveis mitigações. Não inclua tokens, bancos ou logs sem antes remover dados sensíveis.

## Versões suportadas

| Linha | Correções de segurança |
| --- | --- |
| `0.7.x-beta` | Sim, até a publicação da próxima linha Beta |
| `0.6.x-beta` e anteriores | Não |

Atualize para a Beta mais recente antes de relatar ou validar uma correção. O projeto reutiliza a autenticação do Codex CLI e nunca deve transportar credenciais pelo renderer.
