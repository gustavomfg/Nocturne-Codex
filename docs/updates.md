# Atualizações

O Nocturne Studio consulta atualizações somente quando está empacotado. A
versão de desenvolvimento e o smoke de pacote não acessam o serviço de release.

## Fluxo

1. O aplicativo consulta a release após a inicialização e, depois, a cada seis
   horas, sem permitir consultas sobrepostas.
2. Quando existe uma versão, o diálogo mostra a versão e notas sanitizadas antes
   de pedir consentimento.
3. O download só começa após confirmação. O progresso aparece no indicador do
   sistema operacional e o aplicativo continua utilizável.
4. O pacote baixado passa pela validação do `electron-updater`.
5. A instalação ocorre após nova confirmação ou no encerramento do aplicativo.

Se a conexão cair, o indicador de progresso é limpo e o aplicativo oferece
`Retomar download`. A nova tentativa volta a usar o atualizador e exige a mesma
validação antes de instalar. Recusar ou adiar não remove dados nem bloqueia o
uso da versão atual.

## Publicação

Releases estáveis são publicadas apenas pelo workflow protegido
`.github/workflows/stable-release.yml`, depois de reunir os artefatos assinados
de Linux, Windows e macOS, verificar checksums, assinaturas e o commit da tag.
Os detalhes operacionais ficam em `docs/releases/stable-release.md`.
