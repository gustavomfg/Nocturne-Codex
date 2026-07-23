# ADR-005: Application-Controlled Tool Calling

## Status

Accepted

## Context

Provider tool-calling APIs differ and model requests cannot be trusted as authorization.

## Decision

Tools use normalized contracts, runtime validation, policy evaluation and approval before trusted execution.

## Consequences

Adapters require translation work, but authority remains outside providers.
