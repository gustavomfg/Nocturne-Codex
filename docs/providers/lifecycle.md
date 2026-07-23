# Provider Lifecycle

> **A provider moves through explicit configuration, validation and availability states.**

## Lifecycle

```text
Not configured
   ↓
Draft configuration
   ↓
Validated
   ↓
Enabled
   ↓
Available or degraded
   ↓
Disabled or removed
```

## Configuration

The user supplies non-sensitive settings and, when required, a secret. Secrets are written to secure storage; the renderer receives only masked state.

The secure-storage foundation uses opaque credential references. Provider
configuration may retain a reference and a boolean/masked summary, but only the
main process can resolve it at request time. Creation, rotation and deletion
are atomic vault operations. If operating-system protection is unavailable,
credential persistence is rejected and the Provider cannot be marked ready.

Non-sensitive configuration is persisted globally in SQLite schema 9. A record
contains protocol type, display name, source, endpoint, enabled state,
authentication requirement, timeout and timestamps. Credential references have
a single owning configuration and are omitted from exports. Backup restoration
preserves Provider metadata but intentionally returns authenticated Providers
to a credential-required state.

The persistence repository does not coordinate SQLite and vault mutations by
itself. The main-process configuration service owns that two-resource workflow,
including compensation when either side fails.

The configuration service now:

- serializes create, update and removal operations;
- normalizes endpoint policy before touching persistence;
- permits an unvalidated configuration only as a disabled draft;
- requires and tests a credential before an authenticated Provider is enabled;
- validates enabled configurations with a temporary, unregistered adapter;
- creates a new opaque reference for credential rotation;
- compensates a new vault entry when SQLite persistence fails;
- atomically replaces the registered adapter after persistence succeeds;
- removes obsolete ciphertext after rotation or removal;
- rebuilds adapters and prunes unreferenced vault entries during initialization.

Plaintext used by validation exists only in the temporary main-process call. A
persistent adapter resolves the current opaque reference on demand and never
captures the submitted secret.

At application startup, the main process constructs the Registry, Model
Registry, credential vault and configuration service before registering IPC.
An initialization failure is logged as a degraded Provider subsystem rather
than preventing access to the local Workspace; subsequent operations still
fail through sanitized configuration errors.

The settings interface mirrors this lifecycle. New configurations start as
disabled drafts, enabling changes the primary action to an explicit validation,
stored credentials are represented only by a boolean protected state, and
destructive removal requires confirmation. Unsaved editor state blocks settings
navigation and closing until the user saves, cancels or confirms discard.

## Validation

Validation checks:

- schema;
- endpoint policy;
- credential presence;
- connection timeout;
- provider protocol;
- optional model discovery.

A failed validation never marks the provider ready.

## Availability states

Recommended normalized states:

- `not-configured`
- `validating`
- `available`
- `degraded`
- `offline`
- `authentication-required`
- `incompatible`
- `disabled`

## Removal

Removing a provider configuration does not delete historical executions. Workspace bindings become unresolved and require remediation.

## Updates

Adapter or protocol changes should preserve compatibility where possible. Experimental integrations, such as Codex App Server, require a version matrix and contract smoke tests.

## Core rule

> **Ready means validated, not merely configured.**
