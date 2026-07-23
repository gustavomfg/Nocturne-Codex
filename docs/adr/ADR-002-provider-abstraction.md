# ADR-002: Provider-Agnostic AI Execution

## Status

Accepted

## Context

The current Codex CLI integration exposes provider-specific App Server concepts throughout parts of the application.

## Decision

All AI-assisted features communicate through normalized orchestration and provider adapters. Codex CLI becomes one adapter.

## Consequences

Migration requires compatibility façades, but new providers can be added without changing workspace domains.
