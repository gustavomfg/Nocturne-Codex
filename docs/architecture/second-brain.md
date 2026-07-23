# Second Brain

> **The Second Brain is the persistent knowledge system of Nocturne Codex. It stores reviewed knowledge, not conversations.**

---

# Purpose

The Second Brain exists to preserve knowledge that remains valuable beyond a single AI interaction.

Unlike temporary conversations, the Second Brain becomes part of the workspace and evolves together with the project.

It is one of the core architectural domains of Nocturne Codex.

---

# Philosophy

The Second Brain is not an AI feature.

It is a knowledge management system.

Artificial intelligence may suggest knowledge.

Only the user decides what becomes permanent.

Knowledge always belongs to the workspace.

Never to the provider.

---

# Design Principles

The Second Brain follows five principles.

## Persistent

Knowledge survives sessions.

It becomes part of the workspace.

---

## Explicit

Nothing is stored automatically.

Every memory requires user approval.

---

## Structured

Knowledge is organized.

Not appended as raw conversation history.

---

## Local First

Knowledge is stored locally.

The workspace remains the source of truth.

---

## Provider Independent

The Second Brain never depends on a specific AI provider.

It stores information.

It does not execute models.

---

# Architecture

```
Workspace

│

├── Documents

├── Architecture Decisions

├── Memories

├── Sessions

└── Settings
```

The Second Brain owns only the memory domain.

Other domains remain independent.

---

# Memory Lifecycle

Every memory follows the same lifecycle.

```
Conversation

↓

Candidate Memory

↓

User Review

↓

Approved

↓

Second Brain
```

Rejected candidates are discarded.

Temporary conversations never become permanent automatically.

---

# Memory Types

The system may store different kinds of knowledge.

Examples include:

- project knowledge;
- architectural decisions;
- coding conventions;
- implementation details;
- workflows;
- user preferences;
- glossary;
- reusable explanations;
- project constraints.

Future versions may introduce additional memory categories.

---

# Memory Scope

Every memory belongs to a scope.

Examples:

```
Workspace
```

Knowledge shared by the entire project.

---

```
Conversation
```

Knowledge limited to a specific session.

---

```
Future

Global Workspace
```

Shared across multiple workspaces.

Global memory is intentionally postponed until trust policies are fully defined.

---

# Memory Structure

A memory is more than plain text.

Conceptually, every memory contains:

- identifier;
- title;
- content;
- category;
- creation date;
- approval status;
- origin;
- relationships;
- workspace ownership.

Additional metadata may evolve over time.

---

# Relationships

Memories may reference each other.

Examples:

```
Architecture Decision

↓

Related Memory

↓

Documentation
```

This creates a connected knowledge graph instead of isolated notes.

---

# Awareness Integration

Awareness consumes memories.

The Second Brain never decides which memories are relevant.

```
Second Brain

↓

Awareness

↓

Context
```

Awareness is responsible for selection.

The Second Brain is responsible for persistence.

---

# Sessions

Sessions and memories are different concepts.

Sessions describe what happened.

Memories describe what should remain.

A session may produce zero, one or many candidate memories.

---

# Search

The Second Brain supports structured retrieval.

Search is based on:

- titles;
- content;
- metadata;
- categories.

Future versions may include semantic retrieval through embeddings.

Embeddings are not required for the Second Brain to function.

---

# Trust Model

The Second Brain follows explicit trust boundaries.

Artificial intelligence may:

- suggest;
- summarize;
- organize.

Artificial intelligence may never:

- silently modify memories;
- silently delete memories;
- silently approve memories.

The user remains responsible for permanent knowledge.

---

# Versioning

Memories may evolve.

Future versions may support:

- revision history;
- diff visualization;
- rollback;
- merge suggestions.

The initial implementation prioritizes simplicity and trust.

---

# Provider Independence

The Second Brain never knows:

- OpenAI
- Anthropic
- Codex CLI
- Ollama
- OpenRouter
- LM Studio

It receives normalized information produced by the execution pipeline.

Provider changes never affect memory storage.

---

# Security

Workspace memories remain local.

Sensitive information is protected by the same trust boundaries as the rest of the workspace.

Secrets are never promoted into persistent memory.

Credential-like patterns should always be rejected before storage.

---

# Future Evolution

Planned improvements include:

- semantic search;
- embeddings;
- knowledge relationships;
- cross-workspace memories;
- memory health metrics;
- consolidation suggestions;
- duplicate detection;
- knowledge visualization.

Every future capability must preserve explicit user approval.

---

# Summary

The Second Brain is the long-term memory of the workspace.

It preserves knowledge.

It does not replace documentation.

It does not replace conversations.

It complements both.

Artificial intelligence helps generate knowledge.

The user decides what becomes part of the project.
