# Segurança

## Invariantes do Electron

- `contextIsolation` e o sandbox do renderer permanecem habilitados.
- `nodeIntegration` permanece desabilitado.
- permissões do navegador são negadas por padrão;
- navegação externa é bloqueada e links HTTPS abrem fora do renderer;
- o preload expõe apenas métodos nomeados e nunca um `ipcRenderer` genérico;
- IPC valida janela, frame, URL, payload, taxa e autorização do workspace;
- operações privilegiadas e credenciais permanecem no processo principal.

## Workspace e execução

Todo caminho recebido é normalizado e precisa permanecer dentro da raiz
explicitamente selecionada. Workspaces restaurados voltam sem autorização.
Antes de apresentar um workspace salvo como autorizado, o processo principal
verifica sua disponibilidade atual e o acesso de leitura. Projetos apagados,
movidos ou sem permissão preservam o histórico local, mas perdem a autorização
efetiva até uma nova seleção explícita.
Quando uma pasta ausente é relocalizada, a nova raiz passa novamente pelas
validações de escopo e só substitui o caminho persistido após confirmação
explícita. A atualização de conversas, memórias, sugestões, artefatos e bindings
ocorre em uma única transação.
Review é somente leitura. Build pelo Codex usa `workspaceWrite` limitado à raiz,
rede desabilitada e aprovações do usuário para operações solicitadas pelo App
Server.

Providers HTTP recusam redirects e endereços remotos reservados. Antes de cada
conexão remota, todos os endereços resolvidos por DNS são validados e a conexão
é fixada em um deles para impedir DNS rebinding. HTTP sem TLS é aceito apenas
para loopback local.

## Credenciais e persistência

Chaves de Provider são cifradas com `safeStorage`, referenciadas por
identificadores opacos e nunca retornadas ao renderer ou incluídas em backups.
A sessão ChatGPT permanece sob responsabilidade do Codex CLI.

O banco SQLite, WAL, SHM, snapshots, contexto do workspace e cofre usam
permissões restritivas. Logs são sanitizados e o modo detalhado é opt-in.

## Distribuição

Pacotes habilitam ASAR, validação de integridade e fuses que impedem execução
como Node, `NODE_OPTIONS`, inspeção por argumentos e carregamento fora do ASAR.
Releases estáveis exigem pacote assinado por plataforma, checksums verificados
e um smoke do contrato Codex no commit exato da tag.
