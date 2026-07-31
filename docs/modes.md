# Review, Build e Docs

## Review Mode

Review é somente leitura. A análise produz sugestões estruturadas com evidência,
confiança, origem, severidade, justificativa e histórico. Uma nova análise
reconcilia sugestões novas, persistentes, resolvidas e mudanças de severidade.
Nenhuma sugestão altera arquivos por si só.

## Build Mode

Build pode escrever apenas na raiz autorizada, com rede desabilitada e
aprovações explícitas. Atividades, diffs e arquivos alterados ficam visíveis. O
snapshot de rollback é criado antes da execução; uma restauração exige
confirmação e só cobre mudanças registradas pelo fluxo reversível.

Build avançado e automação autônoma continuam fora do compromisso da 1.0.

## Docs Mode

A geração é somente leitura. Para atualizar Markdown, o usuário escolhe o
arquivo, compara conteúdo atual e proposto e decide entre acrescentar ou
substituir. A gravação é atômica, exige confirmação e falha se o arquivo mudou
desde o preview.

Detalhes: `docs/build-recovery.md` e `docs/docs-mode.md`.
