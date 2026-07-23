# Providers

> **Providers are interchangeable execution engines. They execute AI tasks, but they do not define the architecture of Nocturne Codex.**

# Purpose

This document defines how AI providers are configured, managed and used inside Nocturne Codex.

The application is provider-agnostic.

Users are free to configure the providers and models that best fit their workflow.

The workspace remains identical regardless of the selected provider.

---

# Philosophy

Nocturne Codex follows a **Bring Your Own AI** philosophy.

Instead of shipping a single integrated model, the platform allows users to connect their own providers.

Examples include:

- OpenAI
- Anthropic
- OpenRouter
- DeepSeek
- Google Gemini
- Ollama
- LM Studio
- Codex CLI
- Future OpenAI-compatible endpoints

Providers are execution engines.

They are not the product.

---

# Provider Lifecycle

A provider follows the same lifecycle.

```text
Create

↓

Configure

↓

Validate

↓

Enable

↓

Bind Models

↓

Execute Tasks

↓

Collect Statistics
```

---

# Provider Configuration

Each provider owns its own configuration.

Typical fields include:

- display name
- endpoint
- authentication
- timeout
- retry policy
- enabled state

Provider credentials are stored through secure operating-system storage.

Secrets are never persisted inside workspace files.

---

# Global vs Workspace

Providers are configured globally.

Workspaces bind providers to roles.

Example:

```text
Global Provider
OpenRouter

↓

Workspace Binding

Coding → GPT-5 Codex

Documentation → Claude

Review → DeepSeek

Embeddings → Ollama
```

This separation allows one provider configuration to be reused across multiple workspaces.

---

# Provider Types

Two categories exist.

## Remote Providers

Examples:

- OpenAI
- Anthropic
- OpenRouter
- DeepSeek

These require authenticated network requests.

---

## Local Providers

Examples:

- Ollama
- LM Studio

These execute models on the user's machine.

Local providers still follow the same abstraction and security rules.

---

# Capabilities

Providers expose capabilities rather than assumptions.

Examples:

- Chat
- Streaming
- Vision
- Tool Calling
- Embeddings
- Structured Output
- Reasoning

The orchestrator selects only providers capable of executing the requested task.

---

# Health Checks

Providers should expose a lightweight connection test.

The application may verify:

- endpoint availability;
- authentication;
- model discovery;
- version compatibility.

Connection failures never affect unrelated providers.

---

# Statistics

Provider statistics may include:

- executions;
- success rate;
- latency;
- token usage;
- estimated cost;
- active models;
- last successful execution.

Statistics belong to the workspace and execution history, not to the provider itself.

---

# Error Handling

Provider-specific failures are normalized.

Examples:

- Authentication Failed
- Rate Limited
- Timeout
- Invalid Response
- Connection Failed

The renderer should never display provider-native exceptions directly.

---

# Extending the System

Adding a new provider should require:

1. implementing the provider adapter;
2. registering it;
3. declaring capabilities;
4. adding contract tests.

No changes should be required in:

- Workspace
- Awareness
- Second Brain
- Renderer

---

# Future Vision

The provider ecosystem should eventually support:

- provider plugins;
- custom OpenAI-compatible gateways;
- enterprise providers;
- offline-first execution;
- automatic capability discovery;
- usage dashboards.

---

# Summary

Providers are replaceable execution engines.

The workspace, knowledge system and architecture remain stable regardless of which AI executes a task.

> **Bring your own AI. Keep your own workspace.**
