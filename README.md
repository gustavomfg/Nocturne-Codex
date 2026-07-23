# Nocturne Codex

> **A local-first workspace for software development, powered by your knowledge and your choice of AI.**

Nocturne Codex is not an AI chatbot.

It is a workspace designed to help developers understand, build, document and evolve software projects by combining structured knowledge, contextual awareness and artificial intelligence.

Instead of centering the experience around prompts, Nocturne centers it around the project itself.

---

# Vision

Modern software development is no longer just about writing code.

Projects accumulate:

- documentation;
- architecture decisions;
- technical debt;
- design systems;
- implementation history;
- conversations;
- AI interactions.

Most AI tools treat every conversation as an isolated prompt.

Nocturne Codex takes a different approach.

Every interaction happens inside a persistent workspace that understands the project's structure, remembers approved knowledge and provides contextual assistance without forcing developers to repeatedly explain their software.

---

# Philosophy

The project is built around five principles.

## Workspace First

The workspace is the center of the experience.

Artificial intelligence exists to assist the workspace, not replace it.

Everything starts from the project.

Not from the model.

---

## Knowledge First

Information should become reusable knowledge.

Instead of losing valuable discussions inside temporary conversations, Nocturne transforms approved information into structured memory that can evolve together with the project.

Knowledge belongs to the user.

Always.

---

## Provider Agnostic

No AI provider should become a dependency of the application.

Users decide which models they want to use.

Examples include:

- OpenAI
- Anthropic
- OpenRouter
- DeepSeek
- Ollama
- LM Studio
- Codex CLI
- future providers

The workspace remains exactly the same regardless of which provider executes a task.

---

## Local First

Project data should remain local whenever possible.

Workspace information, memories, documentation and architecture belong to the developer.

External services execute AI tasks.

They do not own the workspace.

---

## Human in Control

Artificial intelligence is an assistant.

Not an autonomous owner of the project.

Important decisions always remain reviewable.

Generated knowledge requires explicit approval before becoming persistent.

Transparency is preferred over automation.

---

# Core Concepts

## Workspace

A workspace represents a software project.

It contains everything required to understand and evolve that project.

Examples:

- documentation
- memories
- architecture decisions
- AI sessions
- tasks
- providers
- statistics

---

## Second Brain

The Second Brain stores approved knowledge.

It is persistent.

It is local.

It is owned by the user.

The system never silently promotes temporary conversations into permanent knowledge.

---

## Awareness

Awareness is temporary.

It selects only the information required for the current task.

Awareness is not memory.

Awareness consumes memory.

---

## AI Providers

Artificial intelligence is accessed through interchangeable providers.

No workspace component communicates directly with provider SDKs or proprietary APIs.

Every request passes through the provider abstraction layer.

This architecture allows developers to freely choose the model that best fits each task.

---

# Architecture Overview

```
                Workspace

                     │

        ┌────────────┼────────────┐
        │            │            │
        │            │            │
   Second Brain   Sessions     Documents
        │
        ▼
    Awareness
        │
        ▼
   Task Builder
        │
        ▼
 AI Orchestrator
        │
        ▼
 Provider Layer
        │
 ┌──────┼──────────────┬──────────────┐
 │      │              │              │
OpenAI Claude     OpenRouter     Ollama
 │
Codex CLI
 │
LM Studio
```

The workspace never depends directly on a specific provider.

Providers are execution engines.

The workspace is the product.

---

# What Nocturne Codex Is

Nocturne Codex is:

- a software engineering workspace;
- a knowledge management platform;
- an AI-assisted development environment;
- a documentation hub;
- an architecture companion;
- a project memory system.

---

# What Nocturne Codex Is Not

Nocturne Codex is not:

- another AI chatbot;
- another IDE;
- another note-taking application;
- another wrapper around a language model;
- tied to a single AI provider.

---

# Current State

Current version:

> **0.8.0-beta**

Current highlights:

- Local Second Brain
- Structured project memories
- Workspace-based knowledge
- Review Mode
- Electron secure architecture
- IPC isolation
- Provider-agnostic architecture in development

---

# Roadmap

The current architectural milestone is implementing the Provider System.

Its normalized registries, execution contracts, secure configuration
persistence and typed IPC foundation are in place. The next slices complete
the user-facing configuration and workspace model-selection experience while
preserving the same workspace behavior.

Future work includes:

- Bring Your Own AI
- AI execution pipeline
- Model routing
- Local model support
- Workspace telemetry
- AI statistics
- Cost tracking
- Provider plugins

---

# Documentation

Documentation is organized into independent domains.

- Architecture
- Workspace
- Development
- Security
- Providers
- ADRs
- Review Mode
- Troubleshooting
- Design System

Each document describes a single responsibility and should be read independently.

---

# Design Principles

Every architectural decision follows the same priorities.

1. Security before convenience.
2. Workspace before AI.
3. Knowledge before conversations.
4. User control before automation.
5. Extensibility before provider-specific optimizations.

---

# License

This project is open source.

See the repository license for details.
