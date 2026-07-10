# Changelog

## 0.5.0-beta — 2026-07-10

### Novidades

- modos Build, Review e Docs;
- sugestões estruturadas com decisões e Project Health;
- onboarding verificável e configurações organizadas;
- memória, artefatos, Git, exportação e diagnóstico local.

### Correções

- contenção de streaming e atividades extensas;
- recuperação de falhas do App Server e renderer;
- testes sem sobrescrever `better-sqlite3` carregado pelo Electron;
- validação de paths, IPC e comandos sensíveis.

### Arquitetura

- Electron isolado com preload explícito;
- SQLite com migrações e backup;
- máquina de estados única do agente;
- Review Mode aplicado no sandbox do turno.

### Known Issues

- App Server experimental;
- pacotes ainda sem assinatura e ícone final;
- sem atualização automática;
- exportação avançada depende de Pandoc;
- suporte Beta empacotado somente para Linux x64.
