# Database

> **The database is the persistent backbone of Nocturne Codex. It stores the state of the workspace, not the implementation details of AI providers.**

# Purpose

This document defines the logical data model used by Nocturne Codex.

The database is responsible for persisting the application state while preserving the core architectural principle:

> **The Workspace is the product. AI providers are replaceable.**

The database must never become coupled to a specific provider SDK or API.

---

# Design Principles

The persistence layer follows these principles:

- Local-first
- Provider-independent
- Explicit relationships
- Normalized entities
- Forward-compatible schema evolution
- No secrets in plaintext

---

# Persistence Layers

Nocturne Codex persists data in two complementary layers.

```text
SQLite
│
├── Structured application state
├── Conversations
├── Sessions
├── Memories
├── Statistics
└── Metadata

.nocturne/
│
├── project.json
├── memory.md
└── rules.md

Encrypted credential vault
│
└── Opaque provider credential references and ciphertext
```

SQLite stores structured state.

`.nocturne` stores versionable project metadata.

The credential vault is main-process state under the Electron user-data
directory. It is not part of SQLite, `.nocturne/` or ordinary backup exports.
Provider records store only an opaque reference.

---

# Core Entities

The primary entities are:

- Workspace
- Conversation
- Session
- Message
- Provider
- Model
- Workspace Binding
- Execution
- Memory
- Candidate Memory
- Document
- Artifact
- Finding
- Approval

---

# Workspace

The root entity.

Owns nearly every other record.

Conceptually:

```text
Workspace
├── Conversations
├── Sessions
├── Memories
├── Documents
├── Executions
├── Statistics
└── Provider Bindings
```

---

# Provider

Represents a configured AI provider.

Stores:

- identifier
- adapter/protocol type
- display name
- local or remote source
- endpoint
- enabled state
- authentication requirement
- request timeout
- opaque credential reference
- creation and update timestamps

Secrets are stored outside the database.

Schema 9 stores global Provider configurations in `provider_configs`. The
credential reference is nullable and unique, so one vault entry cannot
accidentally be owned by multiple configurations. Database queries exposed to
presentation return only `credentialConfigured`; resolving the opaque reference
is a main-process responsibility.

Ordinary backups include Provider metadata but deliberately omit
`credential_ref`. Restored Providers therefore require credential submission
again before they can become available.

---

# Model

Represents a normalized model descriptor.

Stores:

- provider reference
- display name
- capabilities
- context window
- pricing metadata
- availability

---

# Provider Binding

Connects a workspace role to a model.

Example:

```text
Workspace

↓

Review Role

↓

Claude

↓

Anthropic
```

Bindings are workspace policy.

---

# Conversations

Conversation history belongs to a workspace.

Stores:

- title
- timestamps
- messages
- linked executions

Conversation history is not permanent knowledge.

---

# Sessions

A session groups related executions.

Typical metadata:

- objective
- execution mode
- provider
- model
- timing
- status

---

# Messages

Messages belong to conversations.

Each message records:

- role
- content
- timestamp
- attachments
- execution references

Provider-native payloads should not be persisted.

---

# Executions

Every AI execution creates an execution record.

Typical fields:

- provider
- model
- execution mode
- latency
- usage
- estimated cost
- result status

Executions are immutable historical records.

---

# Second Brain

Approved knowledge belongs to the memory domain.

Each memory records:

- title
- content
- category
- source
- approval state
- workspace scope

---

# Candidate Memories

Candidate memories are generated during execution.

Lifecycle:

```text
Candidate

↓

Review

↓

Approved

↓

Memory
```

Rejected candidates remain outside the permanent memory system.

---

# Documents

Represents indexed project documentation.

Stores metadata only.

The filesystem remains the source of truth.

---

# Findings

Produced primarily by Review Mode.

Stores:

- severity
- evidence
- affected files
- recommendation
- execution reference

Findings never modify the project.

---

# Artifacts

Artifacts are execution outputs.

Examples:

- reports
- plans
- generated documentation
- exported files

Artifacts preserve provenance.

---

# Approvals

Approval records provide an audit trail.

Examples:

- command approval
- patch approval
- destructive operation
- memory approval

Approvals record:

- who approved
- when
- what operation
- execution reference

---

# Statistics

Statistics are derived from execution history.

Examples:

- executions
- provider usage
- token usage
- latency
- estimated cost

Derived data should never replace raw execution records.

---

# Relationships

Conceptually:

```text
Workspace
│
├── Conversations
│     └── Messages
│
├── Sessions
│     └── Executions
│
├── Memories
├── Documents
├── Findings
├── Artifacts
└── Provider Bindings
      └── Models
            └── Providers
```

---

# Schema Evolution

Future migrations must:

- preserve user data;
- remain backward compatible when possible;
- avoid provider-specific columns;
- introduce normalized tables instead of vendor-specific extensions.

The schema 8 → 9 migration is additive and transactional. It creates Provider
configuration storage and its enabled-state index without changing existing
Workspace, conversation, message or memory records.

---

# Security

The database must never store:

- API keys
- access tokens
- secure credential references in plaintext
- provider SDK objects
- raw authorization headers

Sensitive credentials belong to the operating system's secure storage.

---

# Future Expansion

Future schema additions may include:

- embeddings
- semantic search indexes
- plugin metadata
- organization support
- cloud synchronization metadata
- workspace snapshots

The existing architecture should not require redesign.

---

# Summary

The database preserves the long-term state of Nocturne Codex.

It stores the workspace, knowledge, history and execution metadata while remaining independent from any specific AI provider.

> **Persist the workspace. Normalize the AI. Preserve the architecture.**
