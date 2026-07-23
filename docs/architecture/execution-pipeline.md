# AI Execution Pipeline

> **Every AI interaction inside Nocturne Codex follows the same execution pipeline, regardless of the selected provider or model.**

---

# Purpose

This document describes how an AI task travels through the system.

The pipeline is responsible for transforming a user action into a structured AI execution while preserving:

- workspace context;
- user control;
- provider independence;
- security boundaries;
- execution telemetry.

Every provider follows the same pipeline.

Only the execution adapter changes.

---

# Design Goals

The execution pipeline exists to guarantee:

- deterministic execution;
- reusable context;
- provider independence;
- centralized telemetry;
- explicit trust boundaries.

Every task follows the same lifecycle.

---

# Pipeline Overview

```
User

↓

Workspace

↓

Awareness

↓

Task Builder

↓

AI Orchestrator

↓

Provider Registry

↓

Provider Adapter

↓

Language Model

↓

Normalized Response

↓

Workspace
```

The provider never communicates directly with the workspace.

---

# Step 1 — User Action

Every execution begins with an explicit user action.

Examples:

- ask a question;
- review code;
- generate documentation;
- summarize files;
- explain architecture;
- inspect a project;
- execute an agent.

At this point there is no provider selection.

Only intent.

---

# Step 2 — Workspace Resolution

The workspace becomes the execution root.

The system identifies:

- current project;
- active workspace;
- settings;
- configured providers;
- model bindings;
- permissions.

Everything downstream depends on the workspace.

---

# Step 3 — Awareness

Awareness collects temporary context.

Possible sources include:

- Second Brain
- Documentation
- Architecture Decisions
- Current Session
- Open Files
- User Selection

Awareness never stores data.

It only selects it.

---

# Step 4 — Task Builder

The Task Builder converts user intent into a normalized AI task.

Example:

```
Intent

Review Architecture

↓

Context

Workspace
Memory
Documentation

↓

Expected Output

Markdown
```

The result is provider-independent.

No provider-specific format is generated here.

---

# Step 5 — AI Orchestrator

The orchestrator becomes responsible for execution.

Responsibilities:

- validate task;
- determine required capabilities;
- resolve provider;
- prepare execution;
- collect telemetry;
- normalize response.

The orchestrator never knows provider APIs.

---

# Step 6 — Model and Provider Resolution

The Orchestrator applies the Workspace selection policy and validates the
selected model through the Model Registry before resolving its Provider.

Resolution order:

1. Explicit provider/model pair selected by the user.
2. Provider/model pair bound to the task role.
3. Workspace default provider/model pair.
4. A configured fallback, only when Workspace policy allows it.

If no compatible provider exists, execution stops with a user-facing error.
An explicit user selection is never replaced automatically.

---

# Step 7 — Capability Validation

Before execution, the selected model must satisfy the required capabilities and
its Provider must be available.

Examples:

```
Task

Architecture Review

Requires

✓ Chat
✓ Streaming
✓ Tools
```

If the provider cannot satisfy the task, execution never begins.

---

# Step 8 — Provider Adapter

The adapter converts the normalized task into the provider-specific protocol.

Examples:

```
Normalized Task

↓

OpenAI Request
```

```
Normalized Task

↓

Codex CLI Commands
```

```
Normalized Task

↓

Ollama API
```

This is the only provider-specific layer.

---

# Step 9 — Model Execution

The provider executes the request.

Execution may include:

- streaming;
- tool calls;
- reasoning;
- structured output;
- file operations.

The workspace is unaware of these implementation details.

---

# Step 10 — Response Normalization

Every provider response becomes a normalized response.

Examples:

```
OpenAI

↓

Normalized Response
```

```
Codex CLI

↓

Normalized Response
```

```
Ollama

↓

Normalized Response
```

Renderer components never receive provider-native payloads.

---

# Step 11 — Telemetry

Execution telemetry is recorded.

Typical metrics include:

- provider;
- model;
- latency;
- duration;
- input tokens;
- output tokens;
- cached tokens;
- estimated cost;
- execution status.

Telemetry belongs to the workspace.

Not the provider.

---

# Step 12 — Session Update

The current session receives the execution record.

Sessions may contain:

- user intent;
- provider;
- model;
- execution metadata;
- timestamps;
- linked memories.

Sessions are historical records.

Not permanent knowledge.

---

# Step 13 — Memory Review

Generated information is never persisted automatically.

Instead:

```
Response

↓

Candidate Memory

↓

User Review

↓

Approved

↓

Second Brain
```

Approval is always explicit.

---

# Security Boundaries

Every stage respects trust boundaries.

Renderer

↓

Typed IPC

↓

Main Process

↓

Provider

Secrets never leave trusted processes.

---

# Error Handling

Failures become normalized errors.

Examples:

```
Authentication Error

↓

ProviderAuthenticationError
```

```
Timeout

↓

ProviderTimeoutError
```

```
Unavailable Model

↓

ProviderUnavailableError
```

No provider-specific exception reaches the renderer.

---

# Cancellation

Execution may be cancelled at any point.

Cancellation propagates through:

```
Renderer

↓

Orchestrator

↓

Provider

↓

Model
```

Resources should be released immediately.

---

# Streaming

Streaming follows the same architecture.

```
Provider

↓

Normalized Stream Events

↓

Renderer
```

Renderer never consumes provider-native stream formats.

---

# Why This Matters

The execution pipeline separates:

- user interaction;
- context selection;
- task construction;
- AI execution;
- persistence.

Each responsibility belongs to a different subsystem.

This separation keeps the platform maintainable as new providers, models and capabilities are introduced.

---

# Summary

The execution pipeline guarantees that every AI task follows the same predictable lifecycle.

Providers may change.

Models may evolve.

The pipeline remains the same.

That consistency is one of the foundations of Nocturne Codex.
