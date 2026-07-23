# Architecture

> **The architecture of Nocturne Codex is designed around one principle: the workspace is the product. Artificial intelligence is an interchangeable capability.**

---

# Purpose

Nocturne Codex is built as a local-first software engineering workspace.

Its architecture separates project knowledge from AI execution, allowing the platform to evolve independently from any specific language model or provider.

The system is intentionally modular.

Each subsystem has a single responsibility and communicates through explicit boundaries.

---

# Architectural Principles

Every architectural decision follows these principles.

## Workspace First

The workspace is the central domain.

Artificial intelligence never owns the workflow.

Projects, knowledge, documentation and architecture continue to exist independently of any AI provider.

---

## Provider Agnostic

No business logic depends directly on OpenAI, Anthropic, Codex CLI or any other provider.

Provider-specific logic is isolated behind adapters.

The remainder of the application communicates only with normalized interfaces.

---

## Local First

Workspace data remains local.

Examples include:

- documentation
- memories
- sessions
- architecture decisions
- statistics
- settings

Remote providers execute AI tasks but never become the source of truth.

---

## Explicit Trust Boundaries

Renderer processes never receive unrestricted access to the operating system.

Sensitive operations happen inside trusted processes.

Every boundary is explicit.

---

## Human Approval

Persistent knowledge requires approval.

Artificial intelligence may suggest.

Users decide.

---

# High-Level Architecture

```
                    User

                     │

                     ▼

               Electron Renderer

                     │

             Typed IPC Contracts

                     │

                     ▼

               Electron Main

        ┌────────────┼─────────────┐
        │            │             │
        │            │             │
 Workspace      Second Brain   AI Orchestrator
        │            │             │
        │            │             ▼
        │            │      Provider Registry
        │            │             │
        │            ▼             ▼
 Sessions      Awareness     Provider Adapter
        │                          │
        └──────────────┬───────────┘
                       │
                       ▼
                AI Provider
```

No subsystem bypasses these boundaries.

---

# Domain Overview

The application is divided into independent domains.

## Workspace

Responsible for representing software projects.

Responsibilities include:

- project configuration
- metadata
- workspace settings
- provider bindings
- statistics
- documents

The workspace is the root of every operation.

---

## Second Brain

Responsible for persistent knowledge.

Stores approved information.

Never stores temporary context.

Never executes AI tasks.

---

## Awareness

Responsible for selecting context.

Awareness consumes:

- memories
- documents
- architecture decisions
- workspace information

It produces temporary context.

It never persists information.

---

## Sessions

Responsible for execution history.

Sessions describe:

- conversations
- executed tasks
- provider usage
- execution metadata

Sessions are historical records.

Not memory.

---

## AI Orchestrator

Coordinates AI execution.

Responsibilities include:

- task preparation
- provider selection
- streaming
- cancellation
- telemetry
- normalization

The orchestrator never knows provider-specific protocols.

---

## Provider Layer

Responsible for executing AI requests.

Providers are interchangeable.

Examples:

- Codex CLI
- OpenAI
- OpenRouter
- Ollama
- LM Studio
- Anthropic
- future providers

Each provider exposes the same normalized capabilities whenever possible.

---

# AI Execution Flow

Every AI interaction follows the same pipeline.

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

Model

↓

Normalized Response

↓

Workspace
```

This guarantees identical behavior regardless of the provider.

---

# Provider Architecture

Providers are implementation details.

They are never imported directly by domain modules.

```
AI Orchestrator

↓

AI Provider Interface

↓

Provider Adapter

↓

Remote API

or

↓

Local Runtime
```

Adding a new provider should not require modifications to Workspace, Awareness or Second Brain.

---

# Renderer Isolation

The renderer is considered untrusted.

It never:

- accesses filesystem directly;
- executes commands;
- stores secrets;
- communicates with providers.

All privileged operations pass through IPC contracts.

---

# IPC

IPC is the only communication channel between renderer and main.

Every IPC endpoint:

- has a typed contract;
- validates input;
- validates output;
- exposes only minimum required capabilities.

---

# Secret Management

Secrets never belong to the renderer.

Examples:

- API keys
- access tokens
- provider credentials

Credentials are stored through platform-specific secure storage whenever available.

Renderer receives only configuration state.

Never raw secrets.

---

# Telemetry

Execution telemetry belongs to the workspace.

Examples:

- provider
- model
- latency
- tokens
- duration
- estimated cost

Telemetry never contains sensitive credentials.

---

# Design Philosophy

Nocturne Codex intentionally separates:

- knowledge
- context
- execution
- providers
- presentation

Each domain evolves independently.

This minimizes coupling and maximizes maintainability.

---

# Extensibility

Future providers must integrate through adapters.

The application core should never require modifications when supporting a new provider.

Supported expansion points include:

- providers
- capabilities
- model registry
- execution policies
- telemetry

The workspace remains unchanged.

---

# Documentation

The architecture is further documented in:

- architecture/ai-provider-system.md
- architecture/second-brain.md
- architecture/awareness.md
- architecture/execution-pipeline.md

Provider-specific documentation lives under:

docs/providers/

Each provider describes only its own implementation.

Architecture documents describe the platform itself.

---

# Summary

The architecture of Nocturne Codex follows one fundamental rule:

> **The workspace is permanent. AI providers are replaceable.**

Everything else is a consequence of this decision.
