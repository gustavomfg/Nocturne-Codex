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

Secrets may be submitted once but are never returned.

## Streaming

Start returns an execution ID. Events include the ID and are delivered only to authorized consumers. Subscriptions are narrow and return exact unsubscribe functions.

## Core rule

> **If an operation requires privilege, it crosses a typed, validated IPC contract.**
