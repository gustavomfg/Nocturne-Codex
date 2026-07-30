# Nocturne Studio 1.0

## Documento 02 — Mudanças e Melhorias Necessárias para a Versão 1.0.0

**Versão:** Draft 1.0
**Status:** Em elaboração

---

# Objetivo

Este documento define todas as mudanças, correções, melhorias e estabilizações necessárias para que o Nocturne Studio possa ser considerado pronto para sua primeira versão estável.

Nenhum item deste documento representa novas funcionalidades obrigatórias. O foco é consolidar, estabilizar e finalizar aquilo que já existe.

---

# 1. Identidade do Produto

## 1.1 Padronização do nome

Todos os vestígios do antigo nome **Nocturne Codex** devem ser removidos ou migrados para **Nocturne Studio**.

Inclui:

* nomes internos;
* documentação;
* configurações;
* pipeline;
* artefatos de build;
* release;
* assets;
* metadados.

---

## 1.2 Identidade da aplicação

Definir definitivamente:

* App ID
* Nome interno
* Nome de exibição
* Diretórios utilizados
* Nome dos processos
* Nome das releases

Após a 1.0 essas informações deverão permanecer estáveis.

---

## 1.3 Compatibilidade

Caso exista mudança do App ID, implementar migração automática dos dados existentes.

---

# 2. Workspace

## Melhorias

* validar todos os caminhos antes da abertura;
* impedir referências externas;
* impedir escape via symlink;
* melhorar mensagens de erro;
* validar permissões;
* detectar projetos movidos;
* detectar projetos apagados;
* detectar alterações externas.

---

## Recuperação

Adicionar recuperação automática para:

* workspace renomeado;
* diretório inexistente;
* permissões insuficientes;
* corrupção parcial.

---

# 3. Providers

## Padronização

Todos os Providers devem seguir exatamente o mesmo contrato interno.

Cada Provider deve expor:

* capacidades;
* limitações;
* modelos disponíveis;
* suporte a ferramentas;
* suporte a streaming;
* cancelamento;
* autenticação.

---

## Diagnóstico

Adicionar tela de diagnóstico contendo:

* status;
* conectividade;
* autenticação;
* versão;
* compatibilidade;
* tempo de resposta;
* erros recentes.

---

## Tratamento de Falhas

Adicionar tratamento específico para:

* timeout;
* rate limit;
* chave inválida;
* modelo inexistente;
* endpoint inacessível;
* resposta inválida;
* streaming interrompido.

---

# 4. Codex CLI

## Compatibilidade

Implementar verificação automática de:

* versão mínima;
* versão recomendada;
* autenticação;
* disponibilidade;
* compatibilidade do protocolo.

---

## Recuperação

Permitir:

* reconexão;
* reinicialização;
* cancelamento seguro;
* retomada de sessão.

---

## Interface

Exibir claramente quando:

* Codex não está instalado;
* Codex não está autenticado;
* versão incompatível;
* erro interno.

---

# 5. Review Mode

## Melhorias

Adicionar:

* evidências utilizadas;
* nível de confiança;
* origem da informação;
* categoria;
* severidade;
* justificativa.

---

## Persistência

Cada sugestão deverá possuir:

* ID único;
* histórico;
* estado;
* data;
* responsável.

---

## Estados

Implementar:

* Nova
* Em análise
* Aceita
* Rejeitada
* Resolvida
* Adiada
* Inválida

---

## Comparação

Nova execução da Review deve informar:

* sugestões novas;
* sugestões resolvidas;
* sugestões persistentes;
* mudanças de severidade.

---

# 6. Build Mode

## Segurança

Garantir:

* escrita somente na raiz autorizada;
* nenhuma modificação sem aprovação;
* isolamento completo;
* bloqueio de caminhos externos.

---

## Interface

Adicionar:

* preview;
* diff;
* confirmação;
* progresso;
* cancelamento;
* rollback.

---

## Recuperação

Caso ocorra falha:

* manter arquivos consistentes;
* preservar logs;
* informar exatamente onde ocorreu.

---

# 7. Docs Mode

Adicionar:

* geração incremental;
* comparação;
* preview;
* aprovação;
* atualização parcial.

Nunca substituir documentação automaticamente.

---

# 8. Segundo Cérebro

## Transparência

Mostrar:

* quais memórias foram utilizadas;
* motivo da seleção;
* data;
* origem;
* relevância.

---

## Controle

Permitir:

* editar;
* excluir;
* arquivar;
* restaurar;
* aprovar;
* desaprovar.

---

## Auditoria

Cada memória deve possuir histórico.

---

# 9. Awareness

Melhorar:

* seleção automática;
* relevância;
* explicabilidade;
* filtros;
* priorização.

Adicionar visualização do contexto utilizado em cada execução.

---

# 10. Banco de Dados

## Melhorias

Adicionar:

* validação automática;
* integridade;
* backup antes de migração;
* rollback;
* recuperação.

---

## Migração

Todas as migrações devem ser:

* versionadas;
* reversíveis quando possível;
* documentadas;
* testadas.

---

# 11. Backup

Implementar validação completa de:

* integridade;
* versão;
* compatibilidade.

Adicionar:

* exportação;
* importação;
* restauração parcial;
* verificação antes da restauração.

---

# 12. Atualizações

Melhorar:

* download;
* validação;
* assinatura;
* rollback.

Adicionar:

* notas da versão;
* progresso;
* retomada;
* tratamento para conexão perdida.

---

# 13. Distribuição

Finalizar:

* assinatura;
* notarização;
* checksum;
* publicação automática.

Validar:

* Windows
* Linux
* macOS

---

# 14. Interface

Melhorar:

* mensagens;
* estados vazios;
* carregamento;
* acessibilidade;
* atalhos;
* consistência visual.

---

## Feedback

Adicionar indicadores claros para:

* sucesso;
* erro;
* processamento;
* sincronização;
* recuperação.

---

# 15. Erros

Todas as mensagens devem responder:

* o que aconteceu;
* por que aconteceu;
* o que foi preservado;
* como resolver.

Eliminar mensagens genéricas.

---

# 16. Observabilidade

Adicionar:

* logs estruturados;
* exportação de diagnóstico;
* sanitização;
* identificação de sessão.

Nunca incluir:

* credenciais;
* prompts privados;
* arquivos do projeto completos.

---

# 17. Segurança

Realizar auditoria completa envolvendo:

* Path Traversal;
* Symlink;
* Prompt Injection;
* Markdown hostil;
* DNS Rebinding;
* SSRF;
* Workspace malicioso;
* arquivos gigantes;
* corrupção de dados.

---

# 18. Testes

Adicionar testes completos para:

* instalação;
* atualização;
* migração;
* recuperação;
* backup;
* providers;
* Codex;
* Review;
* Build;
* Docs;
* Workspace;
* Banco.

---

## Testes de Jornada

Automatizar:

Primeiro uso

Workspace

Conversa

Review

Build

Atualização

Recuperação

---

# 19. Documentação

Criar documentação para:

* instalação;
* primeiro uso;
* providers;
* backup;
* restauração;
* troubleshooting;
* segurança;
* privacidade;
* atualização;
* Build Mode;
* Review Mode;
* Docs Mode.

---

# 20. Compatibilidade

Definir oficialmente:

* plataformas suportadas;
* versões suportadas;
* providers suportados;
* versões mínimas.

---

# 21. Performance

Melhorar:

* inicialização;
* abertura de projetos grandes;
* carregamento de contexto;
* memória;
* renderização.

Adicionar métricas internas de desempenho.

---

# 22. Critérios de Bloqueio

A versão 1.0 não poderá ser publicada caso exista qualquer um dos seguintes problemas:

* perda de dados;
* corrupção de banco;
* escrita fora do workspace;
* vazamento de credenciais;
* migração insegura;
* atualização insegura;
* crash reproduzível;
* falha no fluxo principal;
* inconsistência entre Providers;
* Build inseguro.

---

# 23. Itens Pós-1.0

Os seguintes recursos não bloqueiam a versão estável:

* automações;
* plugins;
* múltiplos agentes;
* workflows distribuídos;
* execução totalmente autônoma;
* marketplace;
* sincronização em nuvem;
* colaboração em tempo real.

Esses recursos deverão ser desenvolvidos somente após a estabilização da plataforma.

---

# Checklist Geral

## Produto

* [ ] Fluxo principal concluído
* [ ] Review estabilizada
* [ ] Build estabilizado
* [ ] Workspace confiável

## Segurança

* [ ] Auditoria concluída
* [ ] Todos os testes aprovados

## Dados

* [ ] Migração validada
* [ ] Backup validado
* [ ] Recuperação validada

## Distribuição

* [ ] Builds assinadas
* [ ] Atualização funcionando
* [ ] Publicação automatizada

## Qualidade

* [ ] Zero perda de dados conhecida
* [ ] Zero vulnerabilidades críticas conhecidas
* [ ] Zero crashes reproduzíveis no fluxo principal
* [ ] Documentação concluída
