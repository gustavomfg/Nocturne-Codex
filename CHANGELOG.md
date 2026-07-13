# Changelog

## 0.6.0-beta — 2026-07-11

### Produto e experiência

- interface desktop lapidada com hierarquia, densidade, responsividade e movimentos consistentes;
- sidebar e painel do agente convertidos em drawers funcionais em janelas compactas;
- configurações otimizadas para abertura fluida, sem blur de tela inteira ou diagnóstico concorrente;
- confirmações destrutivas integradas à linguagem visual do Nocturne, com foco controlado e retorno ao elemento de origem;
- feedback explícito para cópia, salvamento, reinício do Codex, aprovações pendentes e operações assíncronas;
- navegação por teclado, diálogos acessíveis, redução de movimento e contraste elevado revisados;
- composer e modos Build, Review e Docs refinados com consequências e estados mais claros.

### Fluxos de engenharia

- sugestões estruturadas persistentes, Saúde do Projeto, planos editáveis, artefatos e memória por workspace;
- commits seletivos por arquivo, com suporte seguro a espaços, Unicode, aspas, quebras de linha e renomeações;
- ciclo de finalização dos turns extraído e protegido contra processamento duplicado;
- matriz de compatibilidade do Codex CLI documentada e validada no onboarding;
- exportação Markdown, HTML, DOCX e PDF integrada ao fluxo de artefatos.

### Estabilidade e segurança

- validação mais estrita de mensagens JSON-RPC, com limite de tamanho e recusa explícita de requests desconhecidos;
- aprovações limitadas aos métodos suportados e limpas após queda ou encerramento do App Server;
- encerramento forçado corrigido para processos do App Server que não respondem ao `SIGTERM`;
- confinamento de workspace reforçado contra traversal por links simbólicos;
- criação de conversas e abertura de ferramentas restritas a workspaces previamente selecionados;
- Content Security Policy explícita no renderer e remoção do polyfill Electron desnecessário;
- acesso IPC residual removido do renderer;
- origem de chamadas IPC privilegiadas validada contra o WebContents e frame principal autorizados;
- contratos compartilhados aplicados ao preload e handlers IPC separados por domínio;
- commits restritos aos caminhos selecionados e validados dentro do workspace;
- migrações SQLite versionadas, transacionais e acompanhadas de backup preventivo;
- serviços do processo principal preservados durante a recriação da janela no macOS, com descarte determinístico de handlers IPC e listeners do Codex;
- ciclo completo do `CodexClient` coberto diretamente, incluindo timeout, aprovações, concorrência, interrupção, queda e reconexão.

### Persistência

- importação limitada a 25 MB e 200 mil registros, com parsing em worker, schemas por tabela e validação de referências;
- exportação e restauração passam a compartilhar os mesmos limites canônicos, impedindo a geração de backups incompatíveis com o próprio produto;
- configurações passam a ser restauradas corretamente pelo backup, sem importar caminhos de executáveis;
- limpeza de órfãos incluída na transação de importação;
- retorno booleano de logs detalhados corrigido ao salvar configurações.

### Interface e manutenção

- configurações reorganizadas para navegação mais fluida e consistente com o aplicativo;
- indicador de foco da busca corrigido para usar somente o contorno externo;
- dependências não utilizadas removidas;
- regressões de protocolo, backup e links simbólicos adicionadas à suíte de testes;
- suíte ampliada para 62 testes automatizados e smoke test no Electron empacotado real;
- ambiente de desenvolvimento formalizado em Node.js 22.12+ da linha 22 LTS e npm 10, validando no CI a versão mínima e a linha atual;
- README, documentação de arquitetura, integração, desenvolvimento e release sincronizados com o produto.

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
