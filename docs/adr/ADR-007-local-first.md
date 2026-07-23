# ADR-007: Local-First Ownership

## Status

Accepted

## Context

Project knowledge and history should not depend on an external service remaining available.

## Decision

Workspace state, memories, sessions and telemetry remain local by default. Remote providers receive minimized task context.

## Consequences

Cloud synchronization and global memory require future explicit designs.
