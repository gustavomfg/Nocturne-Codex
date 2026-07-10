# Review Mode

Review Mode existe para separar análise de alteração. O turno usa sandbox somente leitura mesmo quando a configuração global permite escrita. O agente pode ler, executar verificações seguras, planejar e publicar sugestões; não pode editar, remover ou instalar.

Sugestões incluem evidência, impacto, arquivos, benefícios, complexidade, risco e solução. Visualizar não modifica arquivos. Aplicar exige confirmação e inicia um novo turno Build. Decisões são persistidas no SQLite e na memória `.nocturne/memory.md`.
