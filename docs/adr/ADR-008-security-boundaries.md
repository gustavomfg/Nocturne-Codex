# ADR-008: Electron Trust Boundaries

## Status

Accepted

## Context

The renderer and model output cannot safely own privileged capabilities.

## Decision

The main process owns filesystem, database, commands, providers and secrets. The preload exposes named validated IPC operations.

## Consequences

More boundary code is required, but the privileged surface remains auditable.
