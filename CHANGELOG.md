## 0.9.0-beta

### Added

- Workspace Memory and Second Brain.
- Real Codex CLI execution lifecycle.
- ChatGPT account and API provider separation.
- Secure Provider abstraction layer.
- Provider Registry and Model Registry.
- Provider-independent Task Builder.

### Changed

- Project renamed from Nocturne Codex to Nocturne Studio.
- Documentation reorganized.
- CI/CD and release pipeline improved.
- Electron packaging validation expanded.

### Security

- SQLite files restricted to local user.
- Credential Vault improvements.
- Secure Provider configuration.
- Production audit with zero vulnerabilities.

### Quality

- 200+ automated tests.
- Playwright regression suite.
- Packaging smoke tests.
- Codex CLI smoke validation.
- Actionlint.
- Production dependency audit.

### Known limitations

- Build Mode and Docs Mode still depend on Codex CLI.
- Stable signing identities are external.
- electron-builder development dependency alerts remain pending upstream fixes.
