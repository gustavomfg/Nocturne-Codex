# Identidade estável do produto

Este documento define os identificadores do Nocturne Studio que devem
permanecer estáveis durante a linha 1.x.

| Finalidade | Identificador |
| --- | --- |
| Nome de exibição e processo | `Nocturne Studio` |
| Pacote npm e cliente do Codex App Server | `nocturne-studio` |
| App ID de distribuição | `com.nocturne.codex` |
| Diretório atual de dados | `Nocturne Studio` |
| Diretório legado de dados | `Nocturne Codex` |
| Repositório de atualização | `Nocturne-Codex` |
| Label do runner autenticado | `nocturne-studio` |

`shared/product-identity.json` é a fonte canônica desses valores.

## Identificadores legados preservados

O App ID e o nome do repositório mantêm os valores anteriores para preservar a
continuidade de instalação, assinatura e atualização. Alterá-los antes da 1.0
criaria uma nova identidade de aplicativo nas plataformas suportadas.

O diretório `Nocturne Codex` é reconhecido somente pela migração de dados. Em
uma instalação existente, ele é renomeado atomicamente para `Nocturne Studio`
quando isso pode ser feito sem ocultar ou substituir um banco válido. Se a
migração falhar, o aplicativo continua usando o diretório legado.

## Artefatos

- macOS: `Nocturne-Studio-Mac-<versão>-Installer`
- Windows: `Nocturne-Studio-Windows-<versão>-Setup`
- Linux: `Nocturne.Studio-Linux-<versão>`

Qualquer mudança futura nesses identificadores exige um plano explícito de
migração, validação de atualização nas plataformas afetadas e documentação de
rollback.
