# Segurança

- `contextIsolation: true`, `nodeIntegration: false` e sandbox do renderer;
- Content Security Policy explícita, sem scripts inline ou execução de objetos;
- navegação interna restrita e abertura externa somente por HTTPS;
- argumentos IPC validados com Zod;
- caminhos normalizados e confinados ao workspace;
- workspaces importados permanecem sem autorização: histórico e metadados continuam legíveis, mas memória, Git, arquivos, documentos e Codex exigem nova seleção explícita da pasta original;
- memórias estruturadas só podem ser consultadas ou alteradas através de uma conversa cujo workspace esteja autorizado; criação manual sempre começa como candidata e conteúdo não é escrito em logs;
- recuperação para o Codex aceita somente memórias ativas do escopo atual, limita itens e caracteres, serializa o conteúdo como dados e instrui explicitamente o agente a não executá-lo; candidatas, arquivadas e desatualizadas não entram no contexto;
- criação manual, extração do agente e restauração de backup recusam conteúdo com padrões reconhecíveis de credenciais antes de gravá-lo;
- anexos limitados por formato, quantidade e tamanho;
- política central classifica comandos seguros, sensíveis e perigosos;
- `sudo`, `rm -rf`, `git push`, `git clean`, `git reset`, `mkfs` e equivalentes são destacados como perigosos;
- decisões de aprovação são persistidas;
- logs removem chaves e valores com aparência de token, senha ou autorização.

Não registre conteúdo completo de arquivos em logs. Releases estáveis passam pelo ambiente protegido `stable-release`: macOS exige Developer ID e notarização, Windows exige Authenticode válido e Linux exige checksums assinados por GPG. As chaves nunca são disponibilizadas a pull requests ou ao workflow comum de validação.
