# Execution Policies

> **Execution policy decides what a task may do before any provider or tool acts.**

## Inputs

Policy considers:

- workspace authorization;
- mode;
- requested capabilities;
- local or remote provider;
- budget settings;
- tool permissions;
- command classification;
- user approvals.

## Modes

### Review

Read-only tools and sandbox. Mutation requests are rejected.

### Build

Workspace-scoped mutation may be allowed. Sensitive commands and patches require approval according to policy.

### Docs

Documentation-focused instructions inside the normal sandbox. Strict file-type enforcement should only be claimed when implemented.

## Cost policy

Nocturne may warn, request confirmation or block according to a local budget. This is separate from provider billing enforcement.

## Fallback

Fallback behavior must be explicit and visible. The system does not silently switch to another provider unless the workspace policy permits it.

## Core rule

> **Permission is decided before execution, not inferred from model output.**
