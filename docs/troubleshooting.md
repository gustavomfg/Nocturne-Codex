# Solução de problemas

- **Codex não encontrado:** configure um caminho absoluto em Configurações ou instale o comando `codex` no PATH.
- **Não autenticado:** execute o fluxo de login do Codex CLI no terminal e reinicie o App Server.
- **App Server incompatível:** copie o diagnóstico, confira a versão e atualize o Codex CLI.
- **Workspace removido:** escolha outro workspace; o histórico permanece no SQLite.
- **Git/Pandoc ausente:** instale a ferramenta no sistema. Exportação MD não depende do Pandoc.
- **Banco corrompido:** preserve `nocturne.db`, use o backup criado antes da migração e importe um JSON válido.
- **ABI do better-sqlite3:** execute `npm rebuild better-sqlite3` para testes Node ou `npm run rebuild:native` para Electron.

Ative o modo diagnóstico nas configurações. A mesma tela abre a pasta de logs e copia informações sem credenciais.
