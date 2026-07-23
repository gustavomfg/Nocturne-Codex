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

The first executable adapter uses authorized Workspace roots and ephemeral
threads. It exposes normalized streaming and usage, but deliberately fails
closed for workspace writes and App Server approval requests until the common
Tool Calling policy is implemented. This prevents a local Provider protocol
from silently becoming application authority.

## OpenAI-compatible transport

The generic HTTP adapter uses the platform `fetch` implementation instead of a
provider SDK. Endpoint policy, request timeouts, response limits, SSE parsing,
usage mapping and safe error conversion stay in the main process. Credentials
are supplied by an injected resolver and are never part of normalized tasks,
model descriptors or events.

The transport supports explicit remote HTTPS endpoints and local loopback
runtimes. It does not follow redirects or infer model capabilities from native
catalogs.

## Configuration coordination

The main-process configuration service sits above persistence, secure storage
and adapter construction:

```text
Validated user intent
        ↓
Provider Configuration Service
   ├── SQLite metadata
   ├── Credential vault
   └── Provider Registry
```

Disabled drafts do not require network validation. Enabling, creating or
updating an active Provider requires a successful normalized health check.
Credential rotation creates a new vault reference, commits it with metadata,
replaces the adapter and only then removes the old ciphertext.

## Core rule

> **Provider code ends where normalized Nocturne contracts begin.**
