# Privacidade

Nocturne Studio é local-first. Banco, conversas, sugestões, memórias,
configurações e logs ficam no diretório local de dados do aplicativo.

Conteúdo é enviado a um serviço externo somente quando o usuário executa uma
tarefa com um Provider remoto ou com a conta ChatGPT pelo Codex CLI. O material
enviado é limitado à solicitação, ao histórico/contexto selecionado e aos anexos
explicitamente incluídos. Providers locais permanecem no endpoint configurado.

Credenciais:

- ficam no processo principal;
- são cifradas pelo armazenamento seguro do sistema;
- não chegam ao renderer;
- não entram em backup, logs ou relatório de diagnóstico.

Diagnósticos usam identificação aleatória de sessão e removem prompts,
respostas, diffs, conteúdo de arquivos, caminhos sensíveis e credenciais. As
métricas de desempenho contêm somente números agregados.

O Nocturne Studio é independente e não é um produto oficial da OpenAI.
Políticas do Provider escolhido também se aplicam aos dados enviados a ele.
