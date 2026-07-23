# AI Orchestrator

> **The orchestrator coordinates execution without knowing provider protocols.**

## Responsibilities

- validate normalized tasks;
- resolve model requirements;
- apply workspace bindings;
- enforce execution policy;
- start and cancel providers;
- coordinate tools and approvals;
- normalize events;
- record usage and performance;
- finalize sessions and artifacts.

## Non-responsibilities

The orchestrator does not:

- retrieve workspace context directly;
- store secrets;
- implement provider HTTP or JSON-RPC;
- render UI;
- approve memories;
- bypass security policy.

## Lifecycle

```text
Prepared task
   ↓
Model resolution
   ↓
Policy evaluation
   ↓
Provider client
   ↓
Streaming and tools
   ↓
Completion, failure or cancellation
```

## Testability

A fake provider must support deterministic completion, streaming, failure, cancellation and tool requests.

## Core rule

> **The orchestrator coordinates; adapters translate; domains own their data.**
