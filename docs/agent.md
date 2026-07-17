# Agente

O agente possui estados centralizados: desconectado, iniciando, pronto, planejando, executando, aguardando aprovação, cancelando, concluído e falho.

Build pode modificar dentro do sandbox configurado. Review força somente leitura. Docs adiciona instruções explícitas para alterar apenas documentação relacionada, mas continua dentro do sandbox configurado: essa limitação por tipo de arquivo é instrucional, não um filtro de extensão no filesystem. O App Server é um processo filho supervisionado; erros, saída, memória e contadores são registrados sem conteúdo integral de arquivos.
