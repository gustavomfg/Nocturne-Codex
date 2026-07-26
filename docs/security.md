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
Review é somente leitura. Build pelo Codex usa `workspaceWrite` limitado à raiz,
rede desabilitada e aprovações do usuário para operações solicitadas pelo App
Server.

Providers HTTP recusam redirects e endereços remotos reservados. HTTP sem TLS é
aceito apenas para loopback local.

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
