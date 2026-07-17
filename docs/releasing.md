# Releases

## Plataformas

- Linux x64, Windows x64 e macOS possuem artefatos próprios. Uma release estável só é promovida depois de empacotamento, smoke, assinatura e verificação nas três plataformas.
- Linux x64 continua sendo a plataforma de validação manual primária; suporte de uma plataforma não deve ser anunciado se seu job assinado não tiver passado para a tag publicada.

## Validação automatizada

O workflow `Package validation` executa typecheck, lint, testes, build e renderer em todo push no `master`. Pull requests relevantes, tags e execuções manuais também empacotam e executam smoke test em Linux, Windows e macOS. O smoke test abre o executável unpacked com dados temporários, confirma que `better-sqlite3` abre o banco, verifica a API exposta pelo preload, exercita o bloqueio de novas janelas e navegação inesperada e exige encerramento limpo.

Para reproduzir localmente:

1. Execute `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` e `npm run test:renderer`.
2. Execute `npm run package` para gerar os artefatos e o diretório unpacked.
3. Execute `npm run smoke:package`.
4. Execute `npm run checksums` e confira `release/<versão>/SHA256SUMS`.

O smoke test é ativado somente em um aplicativo empacotado que receba `NOCTURNE_PACKAGE_SMOKE_OUTPUT`; ele não reutiliza dados reais do usuário.

## Publicação

1. Confirme worktree, versão e CHANGELOG.
2. Confirme que `Dependency security` passou no commit da release e anexe ou preserve o SBOM CycloneDX correspondente.
3. Execute `Codex CLI contract smoke` no commit exato da tag e guarde o ID da execução bem-sucedida. O workflow estável exige esse ID e rejeita resultados de outro commit.
4. Exija sucesso do workflow nas três plataformas.
5. Valide manualmente os artefatos da plataforma oficialmente suportada.
6. Publique os pacotes junto ao `SHA256SUMS`, aos arquivos `latest*.yml` e aos `.blockmap` correspondentes. Sem esses metadados, o cliente não anuncia a atualização.
7. Para uma versão estável, crie a tag correspondente à versão (`vX.Y.Z`) e execute manualmente o workflow `Stable signed artifacts`, informando a tag e o ID do smoke do Codex. O ambiente protegido `stable-release` recusa pré-releases, tags divergentes e um smoke pertencente a outro commit. O próprio workflow repete typecheck, lint, testes unitários, renderer e metadata antes de assinar. Depois de verificar também os pacotes, notarização, checksums e metadados das três plataformas, o gate cria ou atualiza o GitHub Release.

## Assinatura e proteção das chaves

- macOS: forneça o certificado Developer ID por `MAC_CSC_LINK`/`MAC_CSC_KEY_PASSWORD` e as credenciais de notarização usadas pelo workflow (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` e `APPLE_TEAM_ID`).
- Windows: forneça um certificado Authenticode por `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`, preferencialmente armazenado em cofre ou serviço de assinatura da organização.
- Linux: publique `SHA256SUMS` e, quando houver uma identidade oficial do projeto, assine também o arquivo de checksums com uma chave dedicada à release.

Configure no ambiente protegido os segredos `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `GPG_PRIVATE_KEY` e `GPG_PASSPHRASE`. O workflow de validação comum continua deliberadamente sem acesso a eles.

`npm run verify:signatures` executa `codesign`/Gatekeeper/stapler no macOS, Authenticode no Windows e checksum + GPG no Linux. Falha ou assinatura ausente interrompe a promoção estável.

`npm run verify:release-assets -- <diretório>` valida no gate agregado a presença dos instaladores Linux, Windows e macOS, do ZIP exigido pelo atualizador no macOS, dos três manifests de atualização e dos checksums por plataforma. A publicação não acontece se qualquer item estiver ausente.

Segredos de assinatura não devem ser disponibilizados em workflows de pull request, logs ou artefatos. Use ambientes protegidos, aprovação manual para releases estáveis e permissões mínimas. Registre data de emissão, expiração e responsável por cada identidade; em uma rotação, revogue a identidade anterior quando aplicável, substitua os segredos e valide um pacote de cada plataforma antes da publicação.

O pacote não contém Codex CLI, login, tokens ou dados do usuário. Releases públicas devem usar os ícones canônicos em tamanhos adequados e não devem incluir capturas locais da interface.
