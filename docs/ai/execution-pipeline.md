# AI Execution Pipeline

> **Every AI task follows the same lifecycle.**

## Pipeline

```text
1. User action
2. Workspace authorization
3. Awareness retrieval
4. Task construction
5. Capability validation
6. Model and provider resolution
7. Execution policy
8. Provider execution
9. Normalized streaming
10. Result persistence
11. Usage and cost recording
12. Optional memory candidates
```

## Cancellation

Every execution receives a stable identifier and cancellation signal. Cancellation propagates through the orchestrator to the provider and any active tools or child processes.

## Streaming

Provider-native chunks become normalized events. The renderer may throttle visual updates, but event order and terminal state remain deterministic.

## Completion

A completed execution records:

- provider and model;
- status and timestamps;
- usage;
- performance;
- estimated cost;
- linked session, conversation and artifacts.

## Failure

Partial messages may remain visible where useful. Failures are normalized and must not expose secrets or raw provider responses.

## Core rule

> **Only adapters change. The execution lifecycle remains stable.**
