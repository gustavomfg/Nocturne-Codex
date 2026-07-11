# Segurança

- `contextIsolation: true`, `nodeIntegration: false` e sandbox do renderer;
- Content Security Policy explícita, sem scripts inline ou execução de objetos;
- navegação interna restrita e abertura externa somente por HTTPS;
- argumentos IPC validados com Zod;
- caminhos normalizados e confinados ao workspace;
- anexos limitados por formato, quantidade e tamanho;
- política central classifica comandos seguros, sensíveis e perigosos;
- `sudo`, `rm -rf`, `git push`, `git clean`, `git reset`, `mkfs` e equivalentes são destacados como perigosos;
- decisões de aprovação são persistidas;
- logs removem chaves e valores com aparência de token, senha ou autorização.

Não registre conteúdo completo de arquivos em logs. Para releases públicas, adicione assinatura de código, CSP explícita e revisão independente do protocolo App Server.
