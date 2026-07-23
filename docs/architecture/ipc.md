# IPC Architecture

> **IPC is the only bridge between renderer intent and privileged capabilities.**

## Shared structure

```text
shared/ipc/
├── channels.ts
├── contracts.ts
├── schemas.ts
├── errors.ts
└── events.ts
```

The preload exposes a narrow `window.nocturne` API. It never exposes `ipcRenderer`.

## Handler lifecycle

```text
Validate input
   ↓
Authorize workspace and operation
   ↓
Call domain service
   ↓
Sanitize and normalize
   ↓
Return result or safe error
```

## Provider IPC

The renderer sees provider summaries, model descriptors, execution identifiers and normalized events. It never sees native OpenAI, Codex, Ollama or other provider payloads.

Configuration operations are exposed as named list, create, update, remove and
connection-test methods. Their inputs are validated again in the main process.
Results cross the boundary through a discriminated envelope so the preload can
reconstruct stable, sanitized domain errors without exposing native failures.

Secrets may be submitted once but are never returned. The preload does not
retain them, and configuration responses contain only
`credentialConfigured`.

## Model IPC

The renderer can list normalized descriptors, request discovery for one named
Provider and read or update Workspace model bindings through `models.*`
operations. Discovery responses contain no Provider-native payloads. Binding
reads and writes require the Workspace to be currently authorized, validate the
same strict shared contract in the main process and return sanitized error
envelopes.

## Streaming

Start returns an execution ID. Events include the ID and are delivered only to authorized consumers. Subscriptions are narrow and return exact unsubscribe functions.

## Core rule

> **If an operation requires privilege, it crosses a typed, validated IPC contract.**
