# Segundo Cérebro

O Segundo Cérebro armazena conhecimento local estruturado por workspace ou por
conversa. Apenas memórias no estado **Ativa** podem ser selecionadas como
contexto de uma execução.

Cada memória informa:

- tipo e escopo;
- estado atual e confiança;
- origem manual, mensagem ou proposta do agente;
- data de criação e atualização;
- último uso e quantidade de usos;
- histórico auditável de criação, edição e mudanças de estado.

Novas memórias começam como candidatas. O usuário pode aprovar ou desaprovar
uma candidata, editar seu conteúdo, marcar uma memória ativa como
desatualizada, arquivar, restaurar ou excluir definitivamente uma memória já
arquivada. Arquivar e desaprovar preservam o histórico; excluir remove a memória
e seu histórico após confirmação.

As alterações da memória e seus registros de histórico são gravados na mesma
transação. O histórico também participa da exportação, validação e restauração
de backups. Backups anteriores ao schema 15 recebem um registro inicial para
cada memória restaurada.
