# Recuperação do Build Mode

Build Mode mantém as políticas de aprovação do Codex App Server, limita a
escrita à raiz autorizada e publica progresso, arquivos e diff no painel do
agente.

## Rollback

Antes de iniciar um Build, o Studio verifica o estado Git do workspace. O
rollback só fica disponível quando:

- existe um commit `HEAD`;
- o workspace estava limpo antes da execução;
- o agente reportou os caminhos alterados;
- todos os caminhos permanecem dentro da raiz autorizada.

Após confirmação explícita, arquivos versionados reportados são restaurados a
partir de `HEAD` e arquivos novos reportados são removidos. O rollback nunca é
oferecido sobre um workspace que já continha alterações do usuário, pois nesse
caso não seria possível separar mudanças anteriores das mudanças do agente com
segurança.

Falhas informam o caminho exato em que a restauração parou e preservam o estado
de rollback para nova inspeção. O usuário deve revisar o diff atual antes de
confirmar a operação.
