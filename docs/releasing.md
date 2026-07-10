# Releases

1. Confirme worktree e versão.
2. Execute `npm ci`, typecheck, lint e testes.
3. Atualize CHANGELOG, versão e execute `npm run package`.
4. Teste o AppImage e o binário unpacked com um workspace descartável.
5. Verifique AppImage e tar.gz em `release/<versão>/`.
6. Publique hashes e assine os artefatos fora deste fluxo.

O pacote não contém Codex CLI, login, tokens ou dados do usuário. Releases públicas devem trocar o placeholder de screenshot e fornecer ícones próprios em tamanhos adequados.
