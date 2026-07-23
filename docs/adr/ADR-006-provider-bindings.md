# ADR-006: Workspace Model Bindings

## Status

Accepted

## Context

One global model cannot satisfy every task, cost target or privacy preference.

## Decision

Workspaces bind roles to provider/model pairs, with explicit task override and predictable fallback.

## Consequences

Configuration is more expressive but requires clear remediation when a provider becomes unavailable.
