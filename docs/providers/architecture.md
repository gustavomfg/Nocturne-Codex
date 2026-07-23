# Provider Architecture

> **Provider-specific protocols are isolated behind normalized adapters.**

## Components

```text
AI Orchestrator
      ↓
Provider Registry
      ↓
Provider Adapter
      ↓
Remote API or local runtime
```

## Registry

The registry owns provider definitions and adapter instances. It can:

- list installed provider types;
- resolve a configuration;
- report health;
- expose supported capabilities;
- create an execution client.

## Adapter contract

An adapter should support only the capabilities it actually provides. Typical operations include:

- validate configuration;
- test connection;
- list models;
- start a normalized execution;
- cancel execution;
- normalize usage and errors.

Model discovery is applied to the Model Registry only after the complete
normalized catalog passes validation. Concurrent refreshes use latest-request
wins semantics, so a slower obsolete response cannot replace a newer catalog.

## Boundaries

Adapters may know provider-native protocols.

They may not:

- write workspace files directly;
- persist memories;
- update renderer state;
- bypass execution policy;
- expose credentials;
- return native payloads across IPC.

## Codex CLI

The current Codex App Server remains valuable, but its JSON-RPC concepts become internal to the Codex adapter. `thread/*`, `turn/*`, approvals and deltas are normalized before leaving that boundary.

## Core rule

> **Provider code ends where normalized Nocturne contracts begin.**
