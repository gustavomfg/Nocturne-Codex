# Changelog

## 0.7.0-beta — 2026-07-14

### Produto e experiência

- continuidade de leitura preservada durante respostas longas, com acompanhamento inteligente do streaming e retorno voluntário ao conteúdo mais recente;
- painéis compactos mutuamente exclusivos, modais para teclado, fecháveis por `Escape` e capazes de restaurar o foco ao acionador;
- composer com crescimento progressivo e ações rápidas que preparam prompts editáveis antes do envio;
- estados vazios, onboarding e Atividade reorganizados para comunicar contexto, prontidão e próxima ação útil;
- configurações e superfícies secundárias refinadas para transições fluidas, inclusive no aplicativo empacotado;
- memória do workspace protege edições não salvas, evita salvamentos duplicados e confirma a persistência;
- feedback de configurações, memória, clipboard, sugestões e Git permanece no contexto que iniciou a operação;
- estados assíncronos e erros urgentes são comunicados visualmente e por tecnologias assistivas.

### Sistema visual e acessibilidade

- responsividade consolidada em cinco faixas canônicas, removendo regras legadas e conflitos de cascata;
- tipografia mínima, densidade, alvos interativos, foco, hover, estados desabilitados e movimento revisados de forma consistente;
- diálogos e drawers preservam o contexto de teclado, com contenção de foco e retorno previsível;
- verificação automatizada do design system passa a reconhecer corretamente declarações de largura mínima e máxima;
- quatro referências visuais cobrem larguras desktop e compactas.

### Qualidade e estabilidade

- aquisição de instância única impede processos concorrentes sobre o mesmo banco e restaura a janela existente;
- migrações SQLite passam a ser incrementais, transacionais e testáveis a partir de versões intermediárias;
- handlers IPC foram separados por domínio, mantendo contratos, validação de origem e limites canônicos compartilhados;
- status Git limita diffs extensos e informa truncamento, evitando pressão desnecessária sobre main e renderer;
- ciclo do Codex foi extraído em roteamento e buffering próprios, com recuperação, concorrência, interrupção e reconexão cobertas diretamente;
- restauração de backup, recriação da janela no macOS e descarte de recursos recebem lifecycle determinístico;
- Markdown e clipboard são tratados por superfícies seguras, e anexos e artefatos preservam seus fluxos após mudanças de conversa;
- suíte ampliada para 62 testes unitários e de integração e 15 cenários determinísticos de renderer;
- regressões adicionadas para falhas contextuais, proteção de edições, navegação por teclado e comportamento responsivo;
- builds do renderer, processo principal e preload validados em produção;
- smoke test executado no Electron empacotado, cobrindo preload, SQLite, sandbox, isolamento de contexto e permissões;
- artefatos de release acompanhados por checksums SHA-256.

### Aprimoramentos posteriores da linha 0.7

- backups restauram workspaces como não autorizados, preservam somente o histórico até uma reautorização explícita e bloqueiam memória, Git, arquivos, documentos e Codex;
- registros automáticos de sugestões são neutralizados antes de entrar na memória persistente;
- preferências locais carregam sem aguardar diagnósticos externos, agora paralelos, explícitos e temporariamente armazenados;
- estados compactos do Codex e controles dos painéis laterais permanecem legíveis e sem sobreposição em janelas estreitas;
- indicadores de saúde separam rótulo, nota e explicação, com regressão geométrica no renderer;
- cascata CSS remove declarações sombreadas e passa a rejeitar novas duplicações equivalentes;
- releases estáveis recebem gate protegido para assinatura, notarização e verificação por plataforma;
- smoke opt-in valida o contrato de um Codex CLI real em workspace temporário e produz somente relatório sanitizado;
- pushes no `master` recebem validação de fonte, enquanto o contrato real do Codex passa a ser verificado semanalmente e após mudanças de compatibilidade;
- estilos de Agent e Settings são extraídos por domínio, com ordem canônica, restrições transversais próprias e auditoria automatizada;
- configurações estabilizam a geometria de navegação e controles durante hover, foco e clique, eliminando flick e variações de scrollbar;
- aceleração gráfica volta a ser o caminho padrão, com fallback de software explícito para drivers incompatíveis;
- streaming deixa de renderizar Markdown e de redesenhar a aplicação inteira a cada delta; histórico e inspetor passam a atualizar em fronteiras isoladas;
- diffs, atividades, arquivos alterados e listas Git extensas usam renderização sob demanda e limites visíveis para preservar a responsividade;
- SQLite recebe timeout de concorrência, modo síncrono apropriado ao WAL, verificação de integridade semanal e otimização segura no encerramento;
- falhas ao abrir terminal são capturadas sem derrubar o processo principal, e estados do agente deixam de produzir transições tardias inválidas;
- históricos extensos carregam as 100 mensagens mais recentes primeiro e preservam a posição de leitura ao buscar páginas anteriores;
- WebStorm passa a ser a IDE adotada, inclusive no atalho de abertura de workspace e na documentação de desenvolvimento;
- Electron e PostCSS recebem atualizações patch compatíveis, sem vulnerabilidades conhecidas no audit;
- suíte ampliada para 68 testes unitários e de integração e 22 cenários determinísticos de renderer, incluindo paginação, integração com WebStorm e estresse de streaming e diff.
- atualizações passam a consultar GitHub Releases somente no aplicativo empacotado, exigem consentimento antes do download e preservam metadados de update por plataforma no pipeline.
- o gate estável passa a exigir uma tag coerente, agregar e verificar os artefatos assinados das três plataformas e só então publicar ou atualizar o GitHub Release.
- a troca de Review para Build na mesma conversa agora substitui explicitamente as restrições do turno anterior, permitindo aplicar alterações sem recriar a thread.
- a topbar passa a responder à largura real do painel central e mantém o acionador do inspector fora da barra lateral durante conversas roláveis.

### Known Issues

- App Server ainda é experimental e depende da versão instalada do Codex CLI;
- pacotes ainda não possuem assinatura de código;
- atualizações dependem da publicação conjunta dos pacotes e metadados `latest*.yml` no GitHub Release;
- exportação avançada depende de Pandoc;
- suporte Beta empacotado e validado prioritariamente em Linux x64.

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
- acesso IPC residual removido do renderer.
- origem de chamadas IPC privilegiadas validada contra o WebContents e frame principal autorizados;
- contratos compartilhados aplicados ao preload e handlers IPC separados por domínio;
- commits restritos aos caminhos selecionados e validados dentro do workspace;
- migrações SQLite versionadas, transacionais e acompanhadas de backup preventivo.

### Persistência

- importação limitada a 25 MB e 200 mil registros, com parsing em worker, schemas por tabela e validação de referências;
- configurações passam a ser restauradas corretamente pelo backup, sem importar caminhos de executáveis;
- limpeza de órfãos incluída na transação de importação;
- retorno booleano de logs detalhados corrigido ao salvar configurações.

### Interface e manutenção

- configurações reorganizadas para navegação mais fluida e consistente com o aplicativo;
- indicador de foco da busca corrigido para usar somente o contorno externo;
- dependências não utilizadas removidas;
- regressões de protocolo, backup e links simbólicos adicionadas à suíte de testes.
- suíte ampliada para 34 testes automatizados e smoke test no Electron empacotado real;
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
