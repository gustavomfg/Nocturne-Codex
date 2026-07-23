# Model Registry

> **The Model Registry is the canonical catalog of AI models available to Nocturne Codex. It separates models from providers, allowing the platform to reason about capabilities instead of vendor-specific implementations.**

# Purpose

The Model Registry defines how Nocturne Codex discovers, stores, exposes and selects AI models.

A model is **not** the same thing as a provider.

For example:

```text
Provider
└── OpenRouter
      ├── GPT-5 Codex
      ├── Claude Opus 4
      ├── Gemini 2.5 Pro
      └── DeepSeek V3

Provider
└── OpenAI
      └── GPT-5 Codex

Provider
└── Ollama
      ├── Llama 3.3
      ├── Qwen3
      └── DeepSeek R1
```

The same model family may exist through multiple providers.

The registry abstracts these differences.

---

# Philosophy

Nocturne Codex should reason about:

- capabilities;
- context window;
- pricing;
- latency;
- availability;
- reasoning support.

It should **not** reason about vendor-specific APIs.

The provider executes.

The registry describes.

---

# Responsibilities

The registry is responsible for:

- cataloging models;
- exposing metadata;
- tracking availability;
- normalizing capabilities;
- supporting discovery;
- enabling model selection;
- validating model references used by workspace bindings.

It is **not** responsible for executing requests.

Execution belongs to the AI Orchestrator.

---

# Model Identity

Every model has a stable internal identity.

Conceptually:

```ts
type ModelDescriptor = {
  providerId: string;
  modelId: string;

  displayName: string;
  family?: string;
  version?: string;

  source:
    | "remote"
    | "local";

  capabilities: Capability[];

  contextWindow?: number;
  maxOutputTokens?: number;

  pricing?: Pricing;
  availability: ModelAvailability;
};
```

Models are identified by the pair `providerId + modelId`.

The registry stores normalized metadata.

Provider-native payloads are discarded after normalization.

---

# Discovery

Models may be discovered from:

- provider APIs;
- local runtimes;
- static catalogs;
- manually configured endpoints.

Discovery should not assume every provider exposes the same metadata.

Missing fields are acceptable.

---

# Capabilities

Capabilities determine whether a model can execute a task.

Examples include:

- Chat
- Streaming
- Vision
- Tool Calling
- Embeddings
- Structured Output
- Reasoning

Capabilities are normalized across providers.

---

# Availability

A model may exist in different states.

Examples:

- Available
- Disabled
- Offline
- Missing Credentials
- Incompatible
- Deprecated

Availability belongs to the registry.

Execution status belongs to the orchestrator.

---

# Workspace Bindings

Workspaces bind **roles** to models.

Example:

```text
Coding
↓

GPT-5 Codex

↓

OpenRouter
```

Changing providers should not require changing the workspace role.

---

# Pricing

When available, pricing metadata may include:

- input tokens;
- cached input tokens;
- output tokens;
- currency;
- effective date.

Pricing is informational.

Actual billing remains the provider's responsibility.

---

# Model Selection

Selection follows this order:

1. Explicit user selection.
2. Workspace role binding.
3. Workspace default model.

The initial resolver does not use a global default. The registry validates
compatibility before execution, while fallback remains an explicit Workspace
policy and never overrides a direct user selection.

---

# Filtering

The UI may filter models by:

- provider;
- capability;
- local vs remote;
- reasoning support;
- context window;
- price;
- availability.

Filtering is driven entirely by normalized metadata.

---

# Versioning

Models evolve over time.

The registry should treat:

- GPT-5 Codex
- GPT-5 Codex Preview
- Claude Opus 4
- Claude Sonnet 4

as distinct descriptors.

Historical executions should continue referencing the model used at execution time.

---

# Future Evolution

Possible future improvements include:

- benchmark scores;
- latency history;
- community ratings;
- recommended use cases;
- automatic capability detection;
- fine-grained cost estimation.

These remain optional metadata.

---

# Relationship to Other Documents

Read alongside:

- providers.md
- capabilities.md
- architecture/ai-provider-system.md
- architecture/execution-pipeline.md

---

# Summary

The Model Registry provides a provider-independent view of artificial intelligence.

Providers execute requests.

The registry describes models.

The workspace binds roles.

The orchestrator performs execution.

> **Models are capabilities. Providers are transport. The workspace remains the center.**
