# Agente

O agente possui estados centralizados: desconectado, iniciando, pronto, planejando, executando, aguardando aprovação, cancelando, concluído e falho.

Build pode modificar dentro do sandbox configurado. Review força somente leitura. Docs adiciona instruções explícitas para alterar apenas documentação relacionada, mas continua dentro do sandbox configurado: essa limitação por tipo de arquivo é instrucional, não um filtro de extensão no filesystem. O App Server é um processo filho supervisionado; erros, saída, memória e contadores são registrados sem conteúdo integral de arquivos.

O contexto de cada turno pode incluir um bloco limitado do Segundo Cérebro. Essas memórias foram aprovadas, mas continuam sendo dados que podem estar desatualizados; não substituem a solicitação atual, não ampliam permissões e não podem ser interpretadas como comandos.

Quando conhecimento durável surgir, o agente pode emitir opcionalmente um bloco estruturado `nocturne-memories`. O processo principal valida no máximo cinco entradas, remove o bloco da resposta persistida, deduplica o conteúdo e grava apenas candidatas. Credenciais, conteúdo integral de arquivos, suposições e estado transitório são proibidos pelas instruções de extração; o usuário ainda precisa revisar cada proposta.
