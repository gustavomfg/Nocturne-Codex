# AI Provider System

> **Artificial intelligence is an interchangeable capability. The workspace is permanent. Providers are replaceable.**

---

# Purpose

The AI Provider System defines how Nocturne Codex communicates with language models.

Its primary objective is to completely decouple the workspace from any specific AI provider.

The application must never depend on:

- OpenAI
- Anthropic
- Codex CLI
- Ollama
- OpenRouter
- LM Studio
- any future provider

Instead, every provider is integrated through a common abstraction layer.

---

# Design Goals

The Provider System exists to achieve five goals.

## Provider Independence

The application core never imports provider-specific SDKs.

Business logic depends only on normalized interfaces.

---

## User Freedom

Users decide:

- which providers to configure;
- which models to use;
- which provider executes each task.

No provider is mandatory.

---

## Extensibility

Supporting a new provider should require implementing a single adapter.

No architectural changes should be necessary.

---

## Transparency

Every execution exposes:

- provider
- model
- latency
- token usage
- estimated cost
- execution status

Nothing happens silently.

---

## Local First

Providers execute AI tasks.

They never own workspace data.

Workspace information remains local.

---

# High-Level Architecture

```
                 Workspace

                     │

                     ▼

             AI Orchestrator

                     │

                     ▼

            Provider Registry

                     │

      ┌──────────────┼──────────────┐
      │              │              │
      ▼              ▼              ▼

 OpenAI Adapter  Ollama Adapter  Codex Adapter

      │              │              │

      ▼              ▼              ▼

   Provider APIs or Local Runtime
```

Every provider implements the same contract.

---

# Core Components

## AI Orchestrator

Coordinates every AI execution.

Responsibilities:

- receive normalized tasks;
- validate requirements;
- resolve provider;
- start execution;
- collect telemetry;
- normalize responses.

The orchestrator contains no provider-specific code.

---

## Provider Registry

Keeps track of every installed provider.

Responsibilities:

- registration;
- discovery;
- availability;
- capability lookup.

Example:

```
Providers

✓ OpenAI

✓ Codex CLI

✓ Ollama

✓ OpenRouter

✓ LM Studio
```

---

## Provider Adapter

Each provider implements an adapter.

The adapter converts between:

Nocturne contracts

↓

provider-specific protocol

Adapters hide implementation details.

---

## Model Registry

Models are not simple strings.

Each model exposes metadata.

Example:

```
GPT-5 Codex

Provider

OpenAI

Capabilities

✓ Chat
✓ Streaming
✓ Tools
✓ Structured Output

Context

400k

Pricing

Input

...

Output

...
```

The workspace interacts with metadata.

Not provider-specific names.

---

# Capabilities

Providers may expose different capabilities.

Examples include:

- chat
- streaming
- tool calling
- vision
- embeddings
- reasoning
- structured output

Capabilities are discovered.

Never assumed.

---

# Execution Flow

Every request follows the same pipeline.

```
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

Model

↓

Normalized Response

↓

Workspace
```

No provider bypasses this flow.

---

# Provider Selection

Users may configure providers globally.

They may also bind providers to specific roles.

Example:

```
Default

DeepSeek Flash

Architecture

GPT-5 Codex

Documentation

Claude

Review

OpenAI

Embeddings

Local Model
```

Different tasks may use different providers.

---

# Configuration

Every provider owns its configuration.

Typical settings include:

- API key
- endpoint
- organization
- timeout
- retry policy

Configuration never leaks outside the provider.

---

# Secrets

Secrets never reach the renderer.

The renderer only knows:

```
Configured

✓

Provider

OpenAI

Key

••••••••8C
```

Actual credentials remain inside secure storage.

---

# Telemetry

Every execution generates telemetry.

Examples:

```
Provider

GPT-5 Codex

Duration

3.2 s

Input

18k tokens

Output

3k tokens

Estimated Cost

US$0.21
```

Telemetry belongs to the workspace.

Not to the provider.

---

# Cost Tracking

When pricing information is available, Nocturne estimates:

- cost per request;
- daily usage;
- workspace usage;
- provider usage;
- model usage.

Local models report execution without monetary cost.

---

# Error Handling

Provider errors become normalized errors.

The workspace never receives provider-specific exceptions.

Examples:

```
Authentication

↓

ProviderAuthenticationError
```

```
Timeout

↓

ProviderTimeoutError
```

```
Rate Limit

↓

ProviderRateLimitError
```

---

# Offline Support

The architecture supports local execution.

Examples:

- Ollama
- LM Studio

Offline providers participate exactly like remote providers.

The workspace does not distinguish between local and remote execution beyond capability metadata.

---

# Future Expansion

The Provider System is intentionally extensible.

Future providers should require:

1. implementing the provider interface;
2. registering the adapter;
3. exposing model metadata.

No other architectural changes should be required.

---

# Design Rules

Every provider must follow these rules.

- never modify workspace state directly;
- never persist memories;
- never bypass the orchestrator;
- never access renderer state directly;
- never expose secrets.

Providers execute.

The workspace decides.

---

# Philosophy

Nocturne Codex does not ship with "the best AI".

It ships with the best environment to use **your AI**.

That distinction defines the entire architecture.
