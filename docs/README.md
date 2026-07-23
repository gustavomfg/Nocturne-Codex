# Nocturne Codex Documentation

> **Nocturne Codex is a local-first software engineering workspace that organizes collaboration between developers and the AI providers they choose.**

## Product vision

The workspace is the product.

Projects, knowledge, sessions, rules, documents and architecture remain useful even when no AI provider is configured. Providers are interchangeable execution engines connected to the workspace through explicit contracts.

Nocturne Codex is:

- workspace-first;
- provider-agnostic;
- local-first;
- human-controlled;
- explicit about permissions, context and cost.

It is not:

- a wrapper around one model;
- an autonomous owner of the project;
- a replacement for Git or an IDE;
- a system that silently converts conversations into permanent truth.

## Current state

The current product line is `0.8.0-beta`.

Version 0.8 introduced the local Second Brain with:

- structured memories scoped to a workspace or conversation;
- candidate review and explicit approval;
- FTS5 search;
- backup and restore;
- bounded retrieval;
- credential-pattern rejection.

The Provider System foundation now includes secure OpenAI-compatible
configuration, normalized model discovery and persistent model bindings per
Workspace. The next slices connect these choices to the complete normalized
execution experience without coupling the Workspace to a vendor.

## Documentation map

### Foundations

- [Architecture](architecture.md)
- [Workspace](workspace.md)
- [Security](security.md)
- [Database](database.md)
- [Development](development.md)
- [Review Mode](review-mode.md)

### AI system

- [Providers](providers/overview.md)
- [Provider Architecture](providers/architecture.md)
- [Provider Lifecycle](providers/lifecycle.md)
- [Provider Integration](providers/integration.md)
- [Model Registry](ai/model-registry.md)
- [Capabilities](ai/capabilities.md)
- [Execution Pipeline](ai/execution-pipeline.md)
- [Execution Context](ai/execution-context.md)
- [Tool Calling](ai/tool-calling.md)
- [Awareness](ai/awareness.md)
- [Second Brain](ai/second-brain.md)

### Internal architecture

- [IPC](architecture/ipc.md)
- [AI Orchestrator](architecture/ai-orchestrator.md)
- [Task Builder](architecture/task-builder.md)
- [Normalization](architecture/normalization.md)
- [Execution Policies](architecture/execution-policies.md)

### Workspace domains

- [Lifecycle](workspace/lifecycle.md)
- [Conversations](workspace/conversations.md)
- [Sessions](workspace/sessions.md)
- [Documents](workspace/documents.md)
- [Artifacts](workspace/artifacts.md)
- [Memory Review](workspace/memory-review.md)

### Decisions

Architecture Decision Records live in [`adr/`](adr/).

## Reading order

A new contributor should read:

1. `architecture.md`
2. `workspace.md`
3. `security.md`
4. `providers/overview.md`
5. `ai/execution-pipeline.md`
6. the ADRs relevant to the task

## Core rule

> **The workspace is permanent. AI providers are replaceable.**
