# Security Policy

Thank you for helping improve the security of Nocturne Studio.

We take security seriously and appreciate responsible disclosure of vulnerabilities.

---

## Reporting a Vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

Instead, use the repository's **GitHub Security Advisory** feature to report the issue privately.

Your report should include, whenever possible:

- Affected version
- Operating system and platform
- Impact assessment
- Steps to reproduce
- Expected behavior
- Actual behavior
- Possible mitigations or workarounds

Before sharing logs or project files, remove any sensitive information such as:

- API keys
- Access tokens
- Authentication cookies
- Database contents
- Personal information

---

## Supported Versions

| Version | Security Updates |
|---------|------------------|
| `0.9.x-beta` | ✅ Supported |
| `0.8.x-beta` | Supported until the next beta release |
| `0.7.x-beta` and earlier | ❌ Not supported |

Please update to the latest beta release before reporting or validating a security issue.

---

## Security Principles

Nocturne Studio follows a security-first architecture.

Current principles include:

- Renderer isolation with `contextIsolation` enabled.
- `nodeIntegration` disabled.
- Explicit IPC communication through the preload layer.
- Authentication handled outside the renderer.
- Support for local models and API providers without exposing secrets to the UI.
- Sensitive credentials are never intended to be embedded in the application source code.

The project currently integrates with the Codex CLI for account-based capabilities. Authentication is delegated to the external tool and credentials must never be transported through the renderer.

---

## Scope

This policy applies to:

- Desktop application
- Electron main process
- IPC layer
- Workspace persistence
- AI provider integrations
- Documentation related to secure operation

Third-party services and providers follow their own security policies.
