# Capabilities

> **Capabilities describe what a model can do, not who provides it. They are the contract between the AI Orchestrator and the Model Registry.**

# Purpose

A capability is a normalized feature exposed by an AI model.

Nocturne Codex never assumes that every model supports the same functionality.

Instead, tasks declare the capabilities they require, and the AI Orchestrator selects a compatible model.

This keeps the platform provider-independent.

---

# Philosophy

The application should ask:

> "Can this model perform this task?"

It should never ask:

> "Is this an OpenAI model?"

Capabilities replace provider-specific assumptions.

---

# Why Capabilities Exist

Different models support different features.

Examples:

- chat
- streaming
- vision
- tool calling
- structured output
- embeddings
- reasoning
- image generation

The Provider Adapter translates provider-specific metadata into a normalized capability set.

---

# Capability Model

Conceptually:

```ts
type Capability =
  | "chat"
  | "streaming"
  | "vision"
  | "tool-calling"
  | "structured-output"
  | "embeddings"
  | "reasoning"
  | "image-generation";
```

Models expose one or more capabilities.

Tasks consume capabilities.

---

# Capability Resolution

Execution follows this flow:

```text
Task

↓

Required Capabilities

↓

Model Registry

↓

Compatible Models

↓

AI Orchestrator

↓

Provider Adapter

↓

Execution
```

If no compatible model exists, execution stops before contacting a provider.

---

# Core Capabilities

## Chat

Supports conversational interaction.

Required by most tasks.

---

## Streaming

Supports incremental token delivery.

Improves perceived responsiveness.

---

## Vision

Accepts image inputs.

Typical uses:

- UI analysis
- screenshots
- diagrams
- design review

---

## Tool Calling

Allows a model to request structured tools.

Tool execution remains controlled by the application.

The provider never executes tools directly.

---

## Structured Output

Supports deterministic structured responses.

Useful for:

- JSON
- planning
- extraction
- schemas
- memory candidates

---

## Embeddings

Produces vector representations.

Future uses include:

- semantic search
- memory retrieval
- document similarity

---

## Reasoning

Represents models designed for complex planning and multi-step analysis.

Reasoning is treated as metadata.

The orchestrator does not assume a provider-specific implementation.

---

## Image Generation

Represents models capable of generating or editing images.

Image generation follows its own execution pipeline and security rules.

---

# Optional Metadata

Capabilities may include metadata such as:

- maximum image size;
- supported formats;
- streaming protocol;
- tool limits;
- structured output version.

This metadata is normalized before reaching the application.

---

# Capability Validation

Before execution the orchestrator verifies:

- every required capability exists;
- the provider is available;
- the model is enabled;
- execution policy allows the request.

Capability validation happens before provider execution.

---

# Capability Evolution

Capabilities are additive.

Adding a new capability should not require redesigning the architecture.

Future examples:

- audio input
- audio output
- video understanding
- web browsing
- computer use
- code interpreter

Existing providers simply report whether they support the new capability.

---

# Relationship to Other Documents

Read alongside:

- providers.md
- model-registry.md
- architecture/ai-provider-system.md
- architecture/execution-pipeline.md
- tool-calling.md

---

# Summary

Capabilities describe behavior.

Models expose capabilities.

Providers transport requests.

The AI Orchestrator matches tasks to compatible models.

> **The application depends on capabilities, never on vendor-specific features.**
