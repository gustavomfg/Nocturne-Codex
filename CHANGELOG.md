# Changelog

## 0.6.0-beta — 2026-07-11

### Estabilidade e segurança

- validação mais estrita de mensagens JSON-RPC, com limite de tamanho e recusa explícita de requests desconhecidos;
- aprovações limitadas aos métodos suportados e limpas após queda ou encerramento do App Server;
- encerramento forçado corrigido para processos do App Server que não respondem ao `SIGTERM`;
- confinamento de workspace reforçado contra traversal por links simbólicos;
- criação de conversas e abertura de ferramentas restritas a workspaces previamente selecionados;
- Content Security Policy explícita no renderer e remoção do polyfill Electron desnecessário;
- acesso IPC residual removido do renderer.

### Persistência

- importação limitada a 100 MB, com colunas e configurações permitidas por lista explícita;
- configurações passam a ser restauradas corretamente pelo backup, sem importar caminhos de executáveis;
- limpeza de órfãos incluída na transação de importação;
- retorno booleano de logs detalhados corrigido ao salvar configurações.

### Interface e manutenção

- configurações reorganizadas para navegação mais fluida e consistente com o aplicativo;
- indicador de foco da busca corrigido para usar somente o contorno externo;
- dependências não utilizadas removidas;
- regressões de protocolo, backup e links simbólicos adicionadas à suíte de testes.

### Known Issues

- App Server ainda é experimental e depende da versão instalada do Codex CLI;
- pacotes ainda não possuem assinatura de código;
- exportação avançada depende de Pandoc;
- suporte Beta empacotado e validado prioritariamente em Linux x64.

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
