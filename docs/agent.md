# Agente

O agente possui estados centralizados: desconectado, iniciando, pronto, planejando, executando, aguardando aprovação, cancelando, concluído e falho.

Build pode modificar dentro do sandbox configurado. Review força somente leitura. Docs prioriza arquivos de documentação. O App Server é um processo filho supervisionado; erros, saída, memória e contadores são registrados sem conteúdo integral de arquivos.
