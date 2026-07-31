# Awareness

Awareness é a seleção automática e explicável do contexto usado em cada
execução. O Studio consulta somente memórias ativas e compatíveis com o
workspace ou com a conversa atual.

Para evitar que a ordem bruta da busca defina o contexto, o seletor avalia um
conjunto limitado de candidatas e calcula uma relevância de 0 a 100 a partir de:

- correspondência textual com o pedido;
- confiança aprovada da memória;
- escopo da conversa ou do workspace;
- idade da última atualização.

Memórias abaixo do limiar de relevância são descartadas. As demais são
priorizadas deterministicamente e continuam sujeitas aos limites de quantidade
e caracteres do contexto.

O snapshot da seleção é persistido nos metadados da mensagem do usuário. No
painel **Atividade → Contexto usado nesta execução**, o usuário pode consultar:

- memória ou contexto utilizado;
- relevância calculada;
- motivo da seleção;
- origem e escopo;
- data de atualização;
- trecho efetivamente enviado como contexto.

Cada mensagem do usuário também mantém um resumo expansível de seu próprio
contexto. Isso permite auditar execuções anteriores depois de reabrir ou paginar
a conversa, sem confundir o snapshot antigo com o contexto da execução atual.

O snapshot permanece junto da conversa em exportações e restaurações. Ele não
contém credenciais e não transforma memórias em instruções: o agente recebe as
entradas como dados potencialmente desatualizados e deve confrontá-las com o
workspace e o pedido atual.
