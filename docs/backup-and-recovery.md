# Backup, restauração e recuperação

## Exportar

Use **Configurações > Dados e diagnóstico > Exportar backup**. O arquivo recebe
versão de formato e checksum SHA-256. Credenciais de Providers não são
exportadas.

## Restaurar

Antes de tocar no banco, o aplicativo verifica tamanho, estrutura, checksum,
versão, compatibilidade, duplicidades e referências. A importação pode restaurar
todo o conteúdo ou somente um projeto. Um snapshot local é criado antes da
operação e a transação é revertida em caso de falha.

Workspaces restaurados permanecem desautorizados. Selecione novamente a pasta
correspondente antes de memória, Git ou IA acessarem o projeto.

## Corrupção do banco

Na inicialização, o SQLite passa por verificação de integridade. Em uma
corrupção recuperável, o arquivo original é colocado em quarentena e o usuário
pode escolher um snapshot íntegro e compatível. Falhas de permissão não são
tratadas como corrupção e não substituem o banco.

Mantenha cópias do backup em mídia sob seu controle. Um backup não inclui os
arquivos do projeto; Git e backups próprios do workspace continuam necessários.
