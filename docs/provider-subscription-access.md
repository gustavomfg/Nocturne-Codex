# Acesso via Assinatura em Provedores de IA

Levantamento de quais provedores permitem conectar ferramentas terceiras
usando assinatura/plano (OAuth) em vez de API key direta.

Data de referencia: Julho de 2026.

---

## OpenAI — ChatGPT Plus / Pro

**Suporte:** Sim, nativo.

A OpenAI permite que ferramentas terceiras (OpenCode, Cursor, etc.) usem
o plano ChatGPT Plus ou Pro via OAuth. O usuario faz login no navegador
e a ferramenta recebe um token — sem necessidade de API key.

O OpenCode ja implementa isso com `opencode auth login`.

OpenAI e o unico provedor grande que mantem suporte explicito a OAuth
para terceiros.

---

## Anthropic — Claude Pro / Max

**Suporte:** Bloqueado desde 04/abril/2026.

A Anthropic mudou a politica: assinaturas Claude Pro ($20/mes) e Max
($100-200/mes) agora cobrem apenas os produtos oficiais:

- Claude.ai (web)
- Claude Code (CLI oficial)
- Claude Desktop
- Claude Cowork

Ferramentas terceiras precisam de:

1. **API key direta** — pay-per-token em console.anthropic.com.
2. **Extra Usage** — creditos pre-pagos por cima da assinatura.

---

## GitHub Copilot

**Suporte:** Parcial.

O GitHub Copilot permite login via conta GitHub em algumas ferramentas
(IDE, terminal). O suporte varia conforme o cliente.

---

## DeepSeek

**Suporte:** API key apenas.

Nao oferece plano com OAuth para terceiros. Pague por token via API key.

---

## Google Gemini

**Suporte:** API key apenas.

Gemini API e pay-per-token. Nao ha plano de assinatura que cubra uso
em ferramentas terceiras.

---

## OpenRouter

**Suporte:** API key apenas.

OpenRouter e um agregador de modelos. Voce paga por uso com creditos
pre-pagos ou cartao. Sem OAuth.

---

## Ollama / LM Studio

**Suporte:** Completamente gratuito e local.

Modelos rodam 100% na maquina do usuario. Nao precisa de assinatura nem
API key. O Nocturne Codex ja suporta via adaptador openai-compatible
apontando para `http://localhost:11434` (Ollama) ou `http://localhost:1234`
(LM Studio).

---

## Resumo

| Provedor          | OAuth / Plano | API key | Gratuito/local |
|-------------------|:---:|:---:|:---:|
| OpenAI            | Sim | Sim | - |
| Anthropic         | Bloqueado | Sim | - |
| GitHub Copilot    | Parcial | Sim | - |
| DeepSeek          | - | Sim | - |
| Google Gemini     | - | Sim | - |
| OpenRouter        | - | Sim | - |
| Ollama            | - | - | Sim |
| LM Studio         | - | - | Sim |

Se o Nocturne Codex quiser suportar conexao via plano/assinatura (sem API
key), o unico provedor viavel hoje e a OpenAI, via OAuth.