# Releases

## Plataformas

- Linux x64 é a plataforma oficialmente suportada durante a Beta.
- Windows x64 e macOS são construídos e submetidos ao smoke test, mas permanecem experimentais até haver validação manual e assinatura próprias de cada plataforma.

## Validação automatizada

O workflow `Package validation` executa typecheck, lint, testes, empacotamento e smoke test em Linux, Windows e macOS. O smoke test abre o executável unpacked com dados temporários, confirma que `better-sqlite3` abre o banco, verifica a API exposta pelo preload e exige encerramento limpo.

Para reproduzir localmente:

1. Execute `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` e `npm run test:renderer`.
2. Execute `npm run package` para gerar os artefatos e o diretório unpacked.
3. Execute `npm run smoke:package`.
4. Execute `npm run checksums` e confira `release/<versão>/SHA256SUMS`.

O smoke test é ativado somente em um aplicativo empacotado que receba `NOCTURNE_PACKAGE_SMOKE_OUTPUT`; ele não reutiliza dados reais do usuário.

## Publicação

1. Confirme worktree, versão e CHANGELOG.
2. Exija sucesso do workflow nas três plataformas.
3. Valide manualmente os artefatos da plataforma oficialmente suportada.
4. Publique os pacotes junto ao `SHA256SUMS` correspondente.
5. Para uma versão estável, configure identidades de assinatura e notarização nos segredos do provedor de CI e remova `CSC_IDENTITY_AUTO_DISCOVERY=false` do job de release. Não publique uma versão estável sem assinatura válida em cada plataforma anunciada.

## Assinatura e proteção das chaves

- macOS: forneça o certificado Developer ID por `CSC_LINK`/`CSC_KEY_PASSWORD` e as credenciais de notarização aceitas pelo Electron Builder (`APPLE_API_KEY`, `APPLE_API_KEY_ID` e `APPLE_API_ISSUER`).
- Windows: forneça um certificado Authenticode por `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`, preferencialmente armazenado em cofre ou serviço de assinatura da organização.
- Linux: publique `SHA256SUMS` e, quando houver uma identidade oficial do projeto, assine também o arquivo de checksums com uma chave dedicada à release.

Segredos de assinatura não devem ser disponibilizados em workflows de pull request, logs ou artefatos. Use ambientes protegidos, aprovação manual para releases estáveis e permissões mínimas. Registre data de emissão, expiração e responsável por cada identidade; em uma rotação, revogue a identidade anterior quando aplicável, substitua os segredos e valide um pacote de cada plataforma antes da publicação.

O pacote não contém Codex CLI, login, tokens ou dados do usuário. Releases públicas devem usar os ícones canônicos em tamanhos adequados e não devem incluir capturas locais da interface.
