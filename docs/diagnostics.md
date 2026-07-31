# Diagnóstico e privacidade

Cada inicialização do Studio recebe um identificador de sessão aleatório. As
entradas do log são JSON e registram data, sessão, nível, categoria, evento e
dados operacionais limitados.

Antes da gravação, o logger:

- remove campos de credencial, prompt, conteúdo, diff e saída bruta;
- mascara padrões conhecidos de tokens e cabeçalhos de autenticação;
- limita strings, listas, objetos e profundidade;
- interrompe referências circulares;
- mantém rotação local e permissões restritivas.

O tráfego bruto do Codex App Server não é armazenado. O diagnóstico registra
somente o canal e a quantidade de bytes recebidos. Falhas do renderer usam uma
impressão SHA-256 curta para correlação, sem persistir a mensagem ou a stack
recebida.

Em **Configurações → Diagnóstico**, o usuário pode copiar ou exportar um relatório
sanitizado. O relatório contém versão do aplicativo e runtimes, plataforma,
arquitetura, identificador e duração implícita da sessão, contagens de eventos,
quantidade de Providers e modelos. Ele não contém credenciais, prompts, conteúdo
de arquivos, diffs ou histórico de conversas.

“Abrir logs” continua disponível para investigação local. O usuário deve revisar
qualquer arquivo antes de compartilhá-lo externamente.
