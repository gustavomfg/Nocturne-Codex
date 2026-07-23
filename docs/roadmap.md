# Roadmap

## Estado atual

**Versão atual: `0.8.0-beta`**

A linha 0.8 introduziu o Segundo Cérebro local e consolidou a base necessária para o próximo grande marco: permitir que cada usuário conecte e escolha os próprios modelos de IA, sem acoplar o Nocturne Codex a um único provedor.

## Entregue na linha 0.7

- testes E2E das fronteiras Electron e smoke do pacote;
- regressão visual e de interação do renderer em breakpoints canônicos;
- matriz versionada e smoke opt-in do contrato App Server;
- checksums publicados e gate automatizado para futuras assinaturas;
- atualização consentida em builds empacotados, com download não automático e metadata por plataforma.

## Entregue na linha 0.8

- Segundo Cérebro local com memórias estruturadas por workspace ou conversa;
- candidatas manuais ou propostas pelo agente, sempre dependentes de aprovação;
- busca FTS5, paginação, backup, restauração e recuperação limitada por relevância;
- rejeição de padrões reconhecíveis de credenciais e separação explícita entre dados lembrados e instruções;
- configuração do Segundo Cérebro pelo próprio usuário, preservando o controle local sobre contexto e memória.

Memória global entre workspaces, embeddings e consolidação semântica permanecem fora do escopo atual até existirem política de confiança, medição de qualidade e justificativa para novas dependências.

## Linha 0.9 — Bring Your Own AI

O próximo marco arquitetural será desacoplar a execução de IA do restante do produto.

O Nocturne Codex deverá controlar contexto, memória, tarefas, sessões e estatísticas, enquanto o usuário escolhe qual provedor e modelo executará cada operação.

### Fundação arquitetural

- criar uma camada de orquestração independente de provedor;
- definir contratos normalizados para requisições, streaming, respostas, erros, cancelamento e uso;
- impedir que Awareness, Memory, Sessions e renderer dependam de SDKs ou formatos específicos de provedores;
- registrar providers e modelos por capacidades, como chat, streaming, ferramentas, visão, embeddings, saída estruturada e reasoning;
- adicionar um provider falso para testes unitários e validação dos contratos.

### Primeiro vertical slice

- conectar um endpoint compatível com a API da OpenAI;
- permitir configuração de `baseUrl`, chave, headers e modelo;
- armazenar credenciais fora do renderer e nunca devolvê-las em texto puro;
- testar conexão e disponibilidade do modelo;
- escolher um modelo padrão por workspace;
- executar uma tarefa do Segundo Cérebro usando o modelo selecionado;
- registrar provider, modelo, tokens, latência, status e custo estimado.

### Seleção e roteamento de modelos

- permitir modelos diferentes por função, como padrão, planejamento, código, revisão, documentação, resumo e embeddings;
- respeitar escolha explícita da tarefa antes de qualquer regra automática;
- validar capacidades exigidas antes da execução;
- oferecer fallback previsível quando um modelo estiver indisponível;
- manter o roteamento transparente e compreensível para o usuário.

### Providers planejados

A prioridade inicial será cobrir o maior número de serviços com poucos adapters bem definidos:

- OpenAI-compatible custom;
- OpenAI;
- OpenRouter;
- DeepSeek;
- Ollama;
- LM Studio por endpoint compatível.

Outros providers serão adicionados somente após os contratos centrais estabilizarem.

### Estatísticas e controle de custo

- uso por workspace, sessão, provider, modelo e tarefa;
- tokens de entrada, cache e saída quando informados pelo provider;
- latência, tempo até o primeiro token, duração e taxa de geração;
- custo estimado com o preço utilizado no momento da execução;
- distinção clara entre custo exato, estimado, gratuito e execução local;
- orçamento mensal, aviso de consumo e limite opcional por tarefa;
- histórico local auditável sem registrar chaves ou conteúdo sensível.

## Marcos posteriores

- suporte amadurecido a modelos locais e funcionamento offline;
- embeddings e recuperação semântica com política explícita de confiança;
- consolidação opcional de memórias com revisão do usuário;
- regras de fallback por disponibilidade, capacidade e orçamento;
- SDK ou sistema de plugins para providers externos, somente após estabilização dos contratos;
- diff e aplicação por hunk;
- acessibilidade e localização ampliadas.

## Distribuição e estabilidade

- provisionar as identidades oficiais e publicar pacotes assinados;
- ícones finais e pacote deb com mantenedor real;
- ampliar a validação do canal de atualização com pacotes assinados publicados;
- manter testes E2E, regressão visual, smoke do pacote e validação das fronteiras Electron como gates de release.

O roadmap não promete datas. A prioridade continua sendo estabilidade, segurança das credenciais, controle do usuário e evolução incremental antes de ampliar integrações.
