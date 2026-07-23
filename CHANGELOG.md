# Changelog

## 0.8.0-beta — 2026-07-16

### Fundação Provider Agnostic

- Provider Registry inicial registra adapters substituíveis, consulta disponibilidade e garante descarte determinístico sem alterar a integração Codex existente;
- Model Registry normalizado identifica modelos por `providerId + modelId`, valida descriptors e preços em runtime e filtra candidatos apenas por capacidades declaradas;
- atualização de catálogo por Provider é atômica e preserva modelos pertencentes aos demais Providers;
- descoberta via adapter preserva o último catálogo válido e impede respostas concorrentes obsoletas de sobrescrever resultados mais recentes;
- eventos iniciais de execução possuem schemas estritos, identificador estável, sequência monotônica, limites explícitos e um único estado terminal;
- Task Builder cria solicitações provider-independent com contexto classificado, seleção explícita ou por role, limites agregados e Review Mode obrigatoriamente somente leitura;
- ferramentas permanecem bloqueadas no contrato inicial até existir validação, política e autorização normalizadas para Tool Calling;
- Workspace Model Bindings resolvem escolha explícita, role e padrão local, validando capacidades e disponibilidade sem substituir silenciosamente a decisão do usuário;
- fallback desabilitado, dependente de confirmação ou previamente configurado possui comportamento distinto e auditável;
- AI Orchestrator executa tarefas normalizadas por adapters substituíveis, centralizando início, terminal, validação de streaming e falhas seguras;
- cancelamento usa `AbortSignal`, é idempotente e prevalece sobre resultados tardios; Provider falso cobre conclusão, falha, payload inválido e interrupção;
- adapter de compatibilidade do Codex CLI confina JSON-RPC, threads efêmeras,
  streaming, uso, falhas e cancelamento ao processo principal, resolvendo o
  Workspace por uma dependência autorizada em vez de aceitar paths do renderer;
- a primeira fatia do adapter Codex executa somente tarefas read-only e recusa
  escrita ou aprovações nativas até existir o contrato comum de Tool Calling;
- adapter OpenAI-compatible reutilizável valida endpoints remotos e loopback,
  resolve credenciais somente no main process e normaliza streaming SSE, uso,
  cancelamento e erros sem expor payloads nativos;
- limites de catálogo, stream e evento, recusa de redirects e confirmação dos
  modelos configurados protegem o primeiro transporte HTTP de Provider;
- cofre de credenciais do main process persiste somente ciphertext atômico com
  referências opacas, permissões `0600` e serialização de mutações concorrentes;
- `safeStorage` usa proteção do sistema operacional e falha fechado no Linux
  quando Secret Service ou KWallet não estão disponíveis, recusando
  `basic_text` e backends desconhecidos;
- schema SQLite 9 adiciona configurações globais de Provider com tipo,
  endpoint, origem, timeout, estado e referência opaca de proprietário único;
- schema SQLite 10 persiste snapshots normalizados do catálogo por Provider e
  bindings de modelos por Workspace, com substituição atômica, migração
  preventiva e restauração validada;
- startup hidrata o Model Registry antes de reconstruir adapters configurados,
  e falhas de persistência durante discovery restauram o catálogo anterior em
  memória;
- backups preservam metadados de Providers, mas removem referências do cofre e
  exigem nova credencial após restauração;
- serviço de configuração do main process coordena validação, SQLite, cofre e
  Registry com serialização e compensação de falhas;
- drafts desabilitados permanecem offline, enquanto Providers habilitados
  exigem health check e credencial válida antes da persistência;
- rotação cria nova referência opaca, troca o adapter de forma atômica e limpa
  ciphertext antigo ou órfão sem capturar plaintext no adapter persistente;
- main process inicializa Registry, Model Registry, cofre e configurações antes
  da janela, preservando o Workspace se o subsistema iniciar degradado;
- IPC e preload tipados expõem somente operações nomeadas de configuração,
  validam novamente os payloads e devolvem resumos e erros sanitizados sem
  credenciais ou referências do cofre;
- API `models.*` expõe somente catálogo normalizado, discovery por Provider e
  bindings validados, exigindo autorização atual do Workspace para ler ou
  alterar sua política;
- Configurações ganha gerenciamento acessível de Providers OpenAI-compatible,
  com drafts offline, credencial transitória, validação explícita, edição,
  teste de conexão e remoção confirmada em layouts desktop e compacto;
- nova seção Modelos coloca o Workspace antes do Provider, permite buscar e
  vincular modelo padrão, planejamento, código, Review e documentação, preserva
  referências sem resolução e atualiza discovery por Provider;
- Codex CLI passa a aparecer como integração opcional, sem ocupar a entrada
  principal das configurações de IA;
- catálogo compartilhado diferencia empresas, protocolos e métodos de conexão
  realmente disponíveis sem tratar assinaturas de consumo como acesso à API;
- discovery OpenAI-compatible consulta `/models` com os mesmos limites de rede,
  preserva metadados já verificados e não inventa capabilities para IDs novos;
- geração de imagens permanece fora do conjunto inicial de capacidades e será tratada em uma etapa futura.

### Estabilidade e compatibilidade

- Codex CLI `0.144.5` homologado com initialize, configuração, thread efêmera, resposta real e cancelamento durante atividade;
- compatibilidade do Codex agora distingue versões incompatíveis, mínimas ainda não verificadas e versões explicitamente homologadas;
- falhas ou respostas inválidas de `thread/start` e `turn/start` estabilizam o estado do agente como falho, preservando diagnóstico;
- troca natural entre Build, Review e Docs preservada na mesma conversa, sem herdar restrições do modo anterior;
- atualizador protegido contra consultas, diálogos, downloads e instalações duplicadas, com retry após falha e cleanup determinístico;
- smoke empacotado passa a exercitar bloqueios reais de novas janelas e navegação inesperada;
- navegações externas iniciadas por frames do renderer também são negadas explicitamente;
- restaurações inválidas agora revertem integralmente, rejeitam identificadores duplicados e preservam o banco anterior;
- migração SQLite 6 → 7 testada com dados da linha 0.7 e novos índices para navegação e relacionamentos;
- bancos de schema futuro são recusados antes de manutenção, e toda migração de schema existente preserva backup restrito;
- contexto do workspace usa I/O assíncrono, gravações atômicas e permissões restritas.

### Performance e distribuição

- importação de backups reutiliza statements preparados, registra duração e volume e possui orçamentos automatizados para restauração, primeira página e round-trip JSON em worker;
- mensagens fora da viewport usam renderização sob demanda nativa do navegador;
- conversas, artefatos e sugestões passam a usar páginas limitadas com carregamento explícito de históricos anteriores;
- pacote conserva somente locales `pt-BR` e `en-US`, reduzindo em aproximadamente 45 MB a instalação Linux descompactada;
- Vite atualizado para `8.1.5` e rebuild nativo alinhado ao fluxo oficial do electron-builder;
- release estável repete toda a suíte, valida workflows, exige smoke do Codex do mesmo commit e testa cada pacote assinado antes da publicação.
- auditoria semanal bloqueia vulnerabilidades altas ou críticas em dependências de produção e gera SBOM CycloneDX por commit analisado.

### Segundo Cérebro

- schema 8 adiciona memórias estruturadas por workspace ou conversa, com tipo, confiança, origem, estado de aprovação, paginação e busca textual FTS5;
- backups validam e restauram as memórias estruturadas, reconstruindo o índice local sem substituir o contexto Markdown existente.
- preload e IPC expõem somente criação de candidatas e operações validadas de consulta, aprovação, edição, arquivamento e exclusão dentro do workspace autorizado.
- diálogo lazy do Segundo Cérebro oferece busca, filtros, paginação e ciclo explícito de revisão sem acumular a coleção no estado global do renderer.
- biblioteca do Segundo Cérebro ganha hierarquia visual, metadados legíveis, feedback de confiança e navegação mobile entre consulta e captura, preservando aprovação humana explícita.
- busca, filtro e ação da biblioteca compartilham altura e alinhamento, enquanto campos focados usam um único contorno violeta sem anéis sobrepostos.
- cada turno recupera somente memórias ativas relevantes, com orçamento de oito itens/6.000 caracteres, serialização como dados e contabilização após `turn/start` aceito.
- respostas podem propor até cinco candidatas estruturadas, validadas e deduplicadas; blocos técnicos são removidos antes da persistência e nenhuma candidata do agente é ativada sem aprovação.

### Qualidade

- 189 testes unitários e de integração;
- 31 cenários determinísticos de renderer, incluindo regressão visual em quatro breakpoints, Providers, modelos por Workspace, Segundo Cérebro e atualização da Saúde do Projeto;
- typecheck, ESLint, design system, build de produção, pacote Linux real e audit npm sem vulnerabilidades aprovados;
- decisões de sugestão precisam persistir antes do turno Build, e o status aplicado exige alterações observadas no escopo aprovado;
- Saúde do Projeto recalcula todas as dimensões após mudanças persistidas nas sugestões e evidencia a transição de cada nota com feedback visual e acessível;
- sanitização de logs cobre credenciais completas em headers, strings JSON e campos estruturados;
- política de segurança, roadmap, plataformas publicadas e documentação visual sincronizados com a linha 0.8.

### Limitações conhecidas

- a interface App Server permanece experimental e novas versões do Codex CLI precisam de homologação explícita;
- exportações DOCX e PDF dependem de uma instalação local do Pandoc;
- a publicação estável depende das identidades externas de assinatura Apple, Windows e GPG configuradas no ambiente protegido.

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
