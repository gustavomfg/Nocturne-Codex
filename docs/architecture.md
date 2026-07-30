# Arquitetura

O Nocturne Studio é um workspace desktop local. O renderer apresenta estado e
solicita operações; ele não recebe acesso direto a Node.js, Electron,
credenciais ou ao sistema de arquivos.

## Processos e limites

- `src/` contém o renderer React e consome apenas a API nominal do preload.
- `electron/preload.ts` expõe contratos explícitos pelo `contextBridge`.
- `electron/ipc/` valida origem, payload, autorização do workspace e limites de
  chamadas antes de alcançar capacidades nativas.
- `electron/` mantém persistência, Git, arquivos, Providers e Codex App Server
  no processo principal.
- `shared/` contém contratos e limites usados nos dois lados da fronteira.

## Execução de IA

Existem dois caminhos intencionalmente distintos:

1. O Codex CLI reutiliza uma conta ChatGPT autenticada ou a autenticação
   configurada no próprio CLI. O App Server fornece ferramentas, streaming,
   aprovações e cancelamento. Review usa sandbox somente leitura; Build limita
   escrita à raiz autorizada e mantém rede desabilitada.
2. Providers OpenAI-compatible usam uma chave de API ou runtime local. O
   contrato atual oferece chat em Review e não simula ferramentas de escrita.

O renderer recebe eventos normalizados com o identificador da conversa. Uma
única execução pode ficar ativa por vez, e aprovações nativas são resolvidas
somente no processo principal.

O processo principal acumula a resposta normalizada e persiste, em uma única
transação, a mensagem e seus artefatos antes de publicar `turn/completed`.
Extrações de sugestões e candidatas do Segundo Cérebro também acontecem nessa
fronteira. Assim, reiniciar o renderer não torna a resposta concluída
dependente de estado React transitório; o renderer apenas reflete a mensagem
já persistida e mantém um caminho legado de recuperação caso a finalização no
processo principal falhe.

## Estado local

SQLite é a fonte de verdade para conversas, catálogo, bindings e conhecimento
estruturado. Migrações são transacionais, restaurações mantêm workspaces sem
autorização e snapshots precedem importações. Contexto editável do projeto
também é mantido em `.nocturne/` com escrita atômica. O processo principal
mantém no máximo um observador nativo para o workspace ativo. Mudanças são
agrupadas, limitadas e enviadas por um canal nomeado do preload; a interface
atualiza o estado Git e recarrega memória/regras quando esses arquivos mudam.

O Segundo Cérebro injeta somente memórias aprovadas e relevantes, sempre
marcadas como potencialmente desatualizadas e serializadas como dados não
executáveis.
