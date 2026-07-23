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
