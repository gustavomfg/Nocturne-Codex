# Provider Integration

> **This guide describes the minimum work required to add a provider.**

## Required pieces

A provider integration needs:

1. a provider definition;
2. a configuration schema;
3. an adapter;
4. capability metadata;
5. model discovery or manual model input;
6. normalized execution events;
7. error mapping;
8. cancellation;
9. tests;
10. documentation.

## Recommended structure

```text
electron/ai/providers/<provider>/
├── adapter.ts
├── config.ts
├── errors.ts
├── models.ts
├── normalizer.ts
└── tests/
```

## Configuration

Separate sensitive and non-sensitive values. Custom endpoints and headers require security review.

## Execution

Convert `NormalizedTask` into the provider request. Emit normalized stream events such as:

- execution started;
- message delta;
- plan update;
- tool request;
- usage update;
- completed;
- failed.

Adapters emit validated event payloads. The Orchestrator owns the common
execution envelope, event sequence and terminal lifecycle, preventing native
provider identifiers or late events from redefining application state.

In the initial contract, adapters receive a normalized task, resolved model and
`AbortSignal`. They may emit message deltas and usage updates, then return a
normalized finish reason or throw a normalized Provider error. They do not emit
start or terminal events directly.

## Error mapping

Map authentication, rate limit, timeout, unavailable model, invalid response and cancellation into shared error codes.

## Codex CLI compatibility adapter

The initial Codex CLI adapter keeps App Server concepts inside the main process:

- availability distinguishes unsupported, minimum-compatible-unverified and
  verified CLI versions;
- the adapter receives a trusted Workspace root resolver rather than a path
  controlled by the renderer;
- every normalized execution uses an ephemeral App Server thread;
- message deltas, usage and terminal state are filtered by the expected thread
  and converted into normalized contracts;
- native failures are replaced by bounded, sanitized Provider errors;
- cancellation interrupts only the turn created for that execution and covers
  cancellation while `turn/start` is still being acknowledged.

This first adapter slice accepts only read-only tasks. Workspace-write execution
and native approval requests fail closed until Tool Calling and approval have a
normalized authorization contract. The existing conversation-specific Codex
compatibility flow remains available while that migration is incomplete.

## Testing

Use deterministic adapter tests. Real provider calls belong in opt-in contract smoke workflows with isolated credentials and temporary workspaces.

## Acceptance criteria

A new provider is complete only when:

- no native payload reaches the renderer;
- cancellation releases resources;
- credentials never enter logs;
- unsupported capabilities fail before execution;
- documentation describes actual behavior.
