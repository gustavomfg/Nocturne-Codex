> **Documentation for Nocturne Studio v0.9.0-beta**

# 🌙 Nocturne Studio

> **A software engineering workspace built around your project—not your prompts.**

Nocturne Studio is a local-first workspace designed to help developers **understand, build, document and evolve software projects** through structured knowledge, contextual awareness and artificial intelligence.

Unlike traditional AI tools, Nocturne Studio treats the **project** as the primary source of context. Artificial intelligence becomes one component of the workspace—not the workspace itself.

---

# Why Nocturne Studio?

Modern software projects are more than source code.

They accumulate documentation, architectural decisions, technical debt, conversations, design systems and operational knowledge.

Most AI tools start every interaction from scratch.

Nocturne Studio takes a different approach.

It builds a persistent engineering workspace where knowledge evolves together with the project, allowing developers to reuse context instead of repeatedly explaining it.

---

# Features

Current capabilities include:

- 🧠 Local Second Brain
- 👁️ Context-aware Awareness system
- 🤖 Multiple AI providers
- 📚 Persistent project knowledge
- 🏗️ Architecture-oriented workspace
- 🔒 Secure Electron architecture
- 🔐 Encrypted credential storage
- ⚡ Secure IPC communication
- 📦 Provider abstraction layer
- 📝 Review Mode

---

# Core Principles

### Workspace First

The project is the center of the experience.

Artificial intelligence assists the workspace instead of defining it.

---

### Knowledge First

Approved information becomes structured project knowledge.

Knowledge belongs to the developer and remains reusable across future work.

---

### Provider Agnostic

No AI provider should become a dependency of the workspace.

Developers choose the provider that best fits each task.

---

### Local First

Workspace data stays local whenever possible.

External services execute AI requests without owning the project.

---

### Human in Control

Artificial intelligence assists decisions.

Developers remain responsible for reviewing, approving and evolving their software.

---

# Architecture

```text
                    Workspace
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    Second Brain     Sessions      Documents
        │
        ▼
    Awareness
        │
        ▼
 Task Orchestrator
        │
        ▼
  Provider Layer
        │
 ┌──────┼───────────────┬──────────────┐
 │      │               │              │
OpenAI Anthropic   OpenRouter      Ollama
 │
Codex CLI
 │
LM Studio
```

The workspace communicates exclusively with the Provider Layer.

Every provider follows the same execution contract, allowing new providers to be integrated without changing the workspace architecture.

---

# AI Providers

Nocturne Studio supports multiple execution backends.

Examples include:

- OpenAI
- Anthropic
- OpenRouter
- DeepSeek
- Ollama
- LM Studio
- Codex CLI

Support for additional providers can be added without modifying the workspace architecture.

---

# Current Status

**Current version**

> **v0.9.0-beta**

Implemented:

- Review Mode
- Workspace Memory
- Second Brain
- Awareness foundation
- Secure Provider System
- Credential Vault
- Provider abstraction
- Secure Electron architecture
- Typed IPC
- Security hardening
- Packaging and release pipeline
- Automated validation workflows

Currently under development:

- Build Mode
- Docs Mode
- Workspace automation
- Expanded provider capabilities

---

# Documentation

Project documentation is organized into dedicated domains.

- Architecture
- Development
- Security
- Providers
- Workspace
- Review Mode
- ADRs
- Troubleshooting
- Design System

Each document focuses on a single responsibility, making the documentation easier to navigate and maintain.

---

# Roadmap

## v0.9.x

- Complete Provider System
- Expand Workspace execution flow
- Improve Review Mode
- Continue Build and Docs Mode development

## v1.0

- Stable Workspace experience
- Complete engineering workflow
- Expanded provider ecosystem
- Plugin-ready architecture

---

# Design Priorities

Every architectural decision follows the same priorities:

1. Security before convenience.
2. Workspace before AI.
3. Knowledge before conversations.
4. Human control before automation.
5. Extensibility before provider-specific implementations.

---

# License

This project is open source.

See the repository license for more information.
