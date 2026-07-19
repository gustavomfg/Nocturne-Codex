# Arquitetura

## Migrações do banco

O SQLite usa uma lista ordenada de migrações versionadas. Cada `up` é executado em uma transação exclusiva e atualiza `user_version` somente no fim da transação. Antes de migrar qualquer banco existente de uma versão anterior suportada, o WAL recebe checkpoint e o arquivo atual é preservado como backup restrito. Uma falha reverte integralmente a versão em andamento. Bancos com `user_version` superior ao schema suportado são recusados antes de manutenção ou migração, evitando downgrade destrutivo.

## Visão geral

O processo principal Electron é a fronteira de confiança. Ele gerencia SQLite, filesystem, Git, Pandoc e o processo filho `codex app-server --stdio`. O preload expõe somente operações nomeadas; o renderer React não possui acesso direto ao Node.js.

```text
Renderer React
    ↓ API tipada do preload
Electron preload
    ↓ canais IPC centralizados
Electron main
    ├── Codex App Server
    ├── SQLite
    ├── filesystem/workspaces
    ├── Git
    └── exportação
```

`CodexClient` associa requests JSON-RPC a responses por `id`, encaminha notificações e mantém threads/turnos. `AgentStateMachine` é a fonte única para o estado operacional. `LocalDatabase` persiste workspaces, conversas, mensagens, artefatos, memória, configurações e auditoria de aprovações.

O Segundo Cérebro complementa o documento `.nocturne/memory.md` com memórias individuais no SQLite. Cada registro possui escopo de workspace ou conversa, tipo, estado, confiança, origem e métricas de uso. Somente memórias ativas podem ser recuperadas; candidatas exigem aprovação explícita. A busca usa FTS5 local e o backup preserva os registros, enquanto o índice é reconstruído a partir da fonte de verdade.

Mensagens, conversas, artefatos e sugestões atravessam IPC em páginas limitadas. O renderer carrega a página inicial e solicita páginas anteriores explicitamente, evitando materializar históricos inteiros nas rotas interativas; os métodos integrais permanecem disponíveis apenas para compatibilidade interna enquanto consumidores antigos são removidos gradualmente.

Na importação e exportação, leitura, parsing e serialização JSON são delegados a workers. Validação Zod, consultas SQLite e inserções transacionais continuam síncronas no processo principal. A suíte aplica orçamentos de regressão a cargas representativas e os logs registram duração e volume, mas o teto aceito de 25 MB e 200 mil registros não equivale a uma garantia de ausência de bloqueio; mudanças nessa rota devem ser medidas antes de ampliar os limites.

O Intelligent Review System recebe um bloco estruturado validado com Zod no processo principal. Sugestões e decisões usam tabelas próprias; Review Mode força `readOnly` no sandbox do turno. Aplicação é um novo turno Build confirmado pelo usuário, nunca efeito de abrir uma proposta.

Dados ficam em `app.getPath('userData')`; logs ficam em `app.getPath('logs')`. Contexto versionável do projeto fica em `<workspace>/.nocturne/`.

## Renderer por domínio

`src/App.tsx` é o composition root do renderer. Ele mantém efeitos de ciclo de vida, coordena o store e conecta handlers de domínio. Elementos visuais e estado local de apresentação ficam fora dele.

```text
src/
├── App.tsx                         # orquestração e integração dos domínios
├── domains/
│   ├── agent/                      # inspector, plano, atividade, artefatos e estilos locais
│   ├── chat/ChatContent.tsx        # welcome, mensagens e Markdown
│   ├── chat/Composer.tsx           # modos, anexos e envio
│   ├── git/GitPanel.tsx            # status e commit confirmado
│   ├── settings/                   # configurações, diagnóstico, diálogos e estilos locais
│   ├── suggestions/                # review, Project Health e proposta
│   └── workspaces/Sidebar.tsx      # conversas, workspaces e perfil
├── shared/format.ts                # formatação e normalização do renderer
├── store.ts                        # estado Zustand e limites de segurança
└── styles/                         # fundação visual e estilos de componentes
```

### Regras de dependência

- Domínios podem importar tipos compartilhados e utilitários puros.
- Domínios não importam outros domínios, exceto composição explícita no `AgentPanel` para Git e Suggestions.
- Acesso a `window.nocturne` permanece nas bordas que executam a ação correspondente.
- `App.tsx` não deve voltar a acumular markup de componentes.
- Estado local de UI, como aba ativa e formulário de configurações, pertence ao componente que o apresenta.
- Estado persistente ou compartilhado entre domínios pertence ao store ou ao processo principal.

## Contratos compartilhados

```text
shared/
├── agentState.ts
├── suggestions.ts
├── types.ts
└── ipc/
    ├── channels.ts   # nomes de canais usados pelo preload
    ├── contracts.ts  # NocturneApi exposta ao renderer
    └── schemas.ts    # schemas Zod reutilizados no main
```

`src/types.ts` é uma fachada de compatibilidade. Código novo pode importar tipos de `src/types` dentro do renderer; a definição canônica vive em `shared/types.ts`. Isso evita renomeações amplas e mantém as APIs públicas existentes.

Os nomes dos canais IPC são definidos uma vez em `shared/ipc/channels.ts`. O preload usa esses valores diretamente. Schemas aplicáveis a mais de um handler ficam em `shared/ipc/schemas.ts`; validações específicas continuam próximas do handler até justificarem compartilhamento.

## Estilos

```text
src/styles/
├── tokens.css       # cores, espaçamento, escala e elevação
├── typography.css   # Geist, Geist Mono e regras tipográficas
├── motion.css       # durações, easing, transições e reduced motion
├── globals.css      # reset, foco, seleção e scrollbars
├── components.css           # shell e estilos compartilhados ainda não extraídos
└── product-constraints.css  # pisos transversais de interação e responsividade
```

Estilos específicos permanecem junto ao domínio, como `domains/agent/agent.css`, `domains/settings/settings.css` e `domains/suggestions/suggestions.css`. A ordem desses arquivos é declarada centralmente em `App.tsx`, evitando que o carregamento lazy altere a cascata. `src/index.css` é apenas o ponto de entrada da fundação global; `styles/product-constraints.css` concentra pisos transversais de interação, tipografia e responsividade. Novos valores globais devem ser tokens e novas animações devem usar o módulo central de motion.

## Processo principal

- `electron/codex`: transporte JSON-RPC e ciclo de vida do App Server.
- `electron/database`: persistência SQLite e migrações.
- `electron/ipc`: validação e implementação das operações expostas.
- `electron/security`: limites de workspace e política de comandos.
- `electron/logging`: logs estruturados e rotação.
- `electron/preload.ts`: adaptação mínima entre contratos e `ipcRenderer`.

O renderer nunca recebe credenciais e não executa comandos diretamente.
Novas janelas são sempre negadas e tentativas de navegação externa iniciadas pelo renderer, inclusive por subframes, são bloqueadas no processo principal.

## Evolução

Ao adicionar trabalho aprovado em versões futuras:

1. Escolher o domínio responsável antes de criar o componente.
2. Manter IPC em canais nomeados e argumentos validados.
3. Reutilizar contratos e tipos canônicos de `shared/`.
4. Evitar estado duplicado entre `App.tsx`, componente e store.
5. Adicionar tokens antes de repetir valores visuais.
6. Validar typecheck, lint, testes e build após cada movimentação estrutural.
