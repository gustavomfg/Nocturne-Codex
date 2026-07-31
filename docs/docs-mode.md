# Docs Mode

Docs Mode prepara documentação sem escrever no workspace durante a geração.
O fluxo mantém análise, aprovação e aplicação como etapas separadas:

1. O agente inspeciona a documentação relacionada em modo somente leitura.
2. A resposta produz uma proposta Markdown incremental e focada.
3. O usuário escolhe um arquivo Markdown dentro do workspace.
4. O Nocturne mostra lado a lado o conteúdo atual e a proposta.
5. O usuário decide cancelar, anexar o conteúdo ou substituir/criar o documento.
6. O processo principal pede uma confirmação final antes de gravar.

Anexar preserva o documento existente e acrescenta a proposta ao final.
Substituir nunca acontece automaticamente: exige a decisão no preview e uma
segunda confirmação nativa.

Entre o preview e a aplicação, o Nocturne verifica o hash do arquivo. Se outro
programa modificar o documento nesse intervalo, a gravação é recusada e uma
nova comparação deve ser gerada. A escrita usa arquivo temporário, sincronização
e renomeação atômica, com permissão restritiva.

Exportações HTML, DOCX e PDF continuam sendo cópias derivadas da resposta e
dependem do Pandoc. Elas não constituem atualização incremental de um documento
fonte.
