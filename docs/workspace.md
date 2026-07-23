# Workspace

> **A workspace is the operational boundary of Nocturne Codex. It connects project files, knowledge, sessions, permissions, AI configuration and execution history without surrendering ownership to any provider.**

## Purpose

A workspace represents a software project inside Nocturne Codex.

It is the primary organizational and security boundary of the application.

Every project-related operation belongs to a workspace, including:

- conversations;
- documents;
- memories;
- architecture decisions;
- AI executions;
- provider bindings;
- statistics;
- reviews;
- artifacts;
- Git operations.

The workspace is the center of the product.

AI providers are capabilities attached to it.

## Core Principle

Nocturne Codex is workspace-first.

The active project determines:

- which files may be accessed;
- which memories may be retrieved;
- which rules apply;
- which provider configuration may be used;
- which execution history is relevant;
- which permissions are available.

```text
Workspace
   │
   ├── Files
   ├── Documents
   ├── Rules
   ├── Memories
   ├── Sessions
   ├── AI configuration
   ├── Statistics
   └── Permissions
```

No provider owns any of these domains.

## Workspace Identity

Each workspace has an internal identifier independent from its filesystem path.

Conceptually:

```ts
type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  normalizedRootPath: string;

  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;

  authorizationState:
    | "authorized"
    | "missing"
    | "requires-reselection"
    | "unavailable";
};
```

The internal identifier is used for:

- database relationships;
- conversations;
- memories;
- provider bindings;
- telemetry;
- settings;
- audit records.

The path represents the current local project location.

These concepts must not be treated as interchangeable.

## Filesystem Root

Every workspace belongs to a normalized filesystem root.

All project-bound operations must remain confined to this root.

Examples include:

- file reads;
- file writes;
- previews;
- attachments;
- document discovery;
- Git operations;
- exports;
- reviews;
- agent commands.

A renderer-provided path is never trusted directly.

The main process resolves the workspace identifier and validates path confinement before performing any operation.

```text
Renderer sends workspace ID and relative path

↓

Main process resolves authorized root

↓

Path is normalized and confined

↓

Operation is executed
```

## Authorization

Opening historical workspace data does not automatically authorize filesystem access.

A workspace may remain visible in the application even when:

- its folder was moved;
- the drive is unavailable;
- the imported database references another machine;
- the original path no longer exists;
- the user has not reselected the directory.

In these states, Nocturne may still display safe historical data such as:

- workspace name;
- conversations;
- messages;
- previous execution metadata;
- non-sensitive statistics.

Protected capabilities remain disabled until the user explicitly selects the workspace folder again.

These include:

- files;
- Git;
- memory retrieval;
- documentation scanning;
- command execution;
- AI tasks that require project context.

## Local Project Configuration

Workspace-versioned configuration lives under:

```text
<workspace>/.nocturne/
```

The directory may contain:

```text
.nocturne/
├── project.json
├── memory.md
└── rules.md
```

Each file has a distinct purpose.

### `project.json`

Describes stable project metadata.

Examples:

- project name;
- stack;
- package manager;
- common commands;
- source directories;
- test commands;
- documentation paths;
- ignored paths.

Example:

```json
{
  "name": "Nocturne Codex",
  "stack": [
    "Electron",
    "React",
    "TypeScript",
    "SQLite"
  ],
  "packageManager": "npm",
  "commands": {
    "typecheck": "npm run typecheck",
    "lint": "npm run lint",
    "test": "npm test",
    "build": "npm run build"
  }
}
```

This file must not contain:

- API keys;
- access tokens;
- personal credentials;
- provider secrets;
- machine-specific authorization data.

### `memory.md`

Stores intentionally versioned project knowledge.

Examples:

- durable decisions;
- project conventions;
- historical context;
- important constraints.

`memory.md` complements the structured Second Brain.

It does not replace the database-backed memory system.

The Markdown file is useful for:

- human-readable project context;
- Git versioning;
- portability;
- project-level instructions.

Structured memories remain useful for:

- lifecycle state;
- scope;
- confidence;
- origin;
- search;
- approval;
- metrics;
- pagination.

### `rules.md`

Stores project-specific operating rules.

Examples:

- code conventions;
- prohibited operations;
- required validation steps;
- architectural constraints;
- formatting expectations;
- release rules.

Rules are not ordinary memories.

They may influence execution behavior and should be classified separately by Awareness.

Rules cannot grant permissions beyond application policy.

For example, a rule cannot authorize:

- paths outside the workspace;
- dangerous commands;
- hidden provider access;
- credential exposure;
- sandbox escalation.

## Ignored Content

Nocturne should ignore high-volume, generated or unsafe paths by default.

Typical defaults include:

- `node_modules`;
- build outputs;
- release artifacts;
- `.git`;
- logs;
- binaries;
- caches;
- temporary directories;
- coverage output;
- generated dependency folders.

Ignored paths reduce:

- accidental data exposure;
- context noise;
- scanning cost;
- performance problems;
- irrelevant AI input.

Workspace configuration may refine exclusions, but security-sensitive exclusions should not be weakened silently.

## Conversations

Every conversation belongs to a workspace.

A conversation may contain:

- user messages;
- normalized AI responses;
- execution metadata;
- linked artifacts;
- plans;
- approvals;
- candidate memories;
- provider and model information.

Conceptually:

```ts
type Conversation = {
  id: string;
  workspaceId: string;
  title: string;

  createdAt: string;
  updatedAt: string;

  archived: boolean;
};
```

Conversations are execution history.

They are not permanent project knowledge.

## Sessions

A session represents a bounded period of work.

A session may span one or more AI turns and may include:

- current objective;
- selected mode;
- provider;
- model;
- context summary;
- commands;
- patches;
- approvals;
- execution result;
- telemetry.

Sessions help answer:

- what happened;
- when it happened;
- which model was used;
- what context was selected;
- what changed;
- how much the execution cost.

Sessions should remain inspectable and attributable.

## Second Brain

Structured memories belong to either:

- a workspace;
- a conversation within that workspace.

Only active and approved memories are eligible for automatic retrieval.

Candidate memories require review.

Archived and outdated memories remain historical but do not enter normal Awareness context.

Workspace memory must never leak into another workspace without explicit future support for cross-workspace sharing.

## Documents

Workspace documents may include:

- README files;
- architecture documentation;
- ADRs;
- security policies;
- design systems;
- roadmaps;
- contributor guides;
- local reference material.

Documents remain source material.

They are not automatically converted into memory.

Awareness may select relevant excerpts for a task while preserving:

- source path;
- title;
- update time;
- document type;
- provenance.

## Architecture Decisions

Architecture Decision Records belong to the workspace knowledge domain.

They should be discoverable separately from ordinary documents because they represent explicit decisions.

An active ADR may constrain:

- implementation direction;
- dependencies;
- data ownership;
- security behavior;
- process boundaries;
- provider integration.

Superseded ADRs remain part of project history but must be marked accordingly.

## AI Configuration

A workspace may define how AI is used without owning provider secrets.

Workspace-level AI configuration may include:

- default provider;
- default model;
- model bindings by role;
- fallback policy;
- execution limits;
- budget preferences;
- allowed capabilities;
- local-only preference;
- provider availability.

Conceptually:

```ts
type WorkspaceAIConfiguration = {
  workspaceId: string;

  defaultBinding?: ModelBinding;

  roleBindings: Partial<
    Record<ModelRole, ModelBinding>
  >;

  fallbackPolicy: "disabled" | "explicit" | "configured";

  executionPolicy: {
    requireConfirmationAboveEstimatedCost?: number;
    preferLocalModels?: boolean;
    allowRemoteProviders?: boolean;
  };
};
```

## Provider Configuration vs Workspace Binding

These concepts must remain separate.

### Provider Configuration

Defines how a provider can be reached.

Examples:

- endpoint;
- authentication reference;
- timeout;
- custom headers;
- enabled state.

It may be global to the application.

### Workspace Binding

Defines how a workspace uses a configured provider.

Examples:

```text
Default
DeepSeek Flash

Planning
GPT Codex

Documentation
Claude

Embeddings
Ollama
```

A binding references:

- provider configuration;
- model;
- role.

It does not duplicate credentials.

## Model Roles

A workspace may assign different models to different responsibilities.

Initial roles may include:

```ts
type ModelRole =
  | "default"
  | "planning"
  | "coding"
  | "review"
  | "documentation"
  | "summarization"
  | "embedding";
```

Roles are workspace policy.

They should not be interpreted as autonomous agents by default.

A task may explicitly override the role binding when the user chooses another compatible model.

## Binding Resolution

The initial resolver evaluates:

1. the exact `providerId + modelId` explicitly selected by the user;
2. the binding for the requested workspace role;
3. the workspace default binding.

An explicit model is never replaced automatically. `disabled` fallback stops
with remediation, `explicit` returns configured alternatives for confirmation,
and `configured` may use only the ordered alternatives previously saved in the
workspace policy. Every fallback result remains visible in execution metadata.

Resolution validates model availability, all required capabilities and Provider
availability before execution. Bindings from another Workspace are rejected.
No global default is used by the initial resolver.

## Provider Independence

Workspace data must not depend on provider-native identifiers or payloads beyond stable references.

Good:

```ts
{
  providerId: "openrouter",
  modelId: "deepseek/example-model"
}
```

Bad:

```ts
{
  openAIRequestBody: { ... }
}
```

The workspace may store normalized execution metadata.

It must not become a persistence layer for arbitrary provider SDK objects.

## Statistics

Statistics are scoped to the workspace.

Examples include:

- number of executions;
- provider usage;
- model usage;
- input tokens;
- output tokens;
- cached tokens;
- estimated cost;
- latency;
- time to first token;
- failure rate;
- cancellation rate;
- tool usage.

Conceptually:

```ts
type WorkspaceUsageSummary = {
  workspaceId: string;
  period: {
    from: string;
    to: string;
  };

  executions: number;

  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };

  estimatedCost?: {
    amount: number;
    currency: "USD";
  };
};
```

Statistics should be based on recorded executions, not inferred from conversation length.

## Cost Control

A workspace may define cost preferences.

Examples:

- warning threshold;
- monthly budget;
- maximum estimated cost per task;
- confirmation before expensive execution;
- fallback to a free or local model;
- disabling paid remote providers.

A budget warning is not necessarily a hard provider billing limit.

Nocturne must make the difference explicit.

```text
Nocturne local budget

is not the same as

provider billing enforcement
```

When strict protection is required, users should also configure limits in the provider account itself.

## Execution History

Every AI execution should be attributable to a workspace.

A record may contain:

```ts
type WorkspaceExecutionRecord = {
  id: string;
  workspaceId: string;
  conversationId?: string;
  sessionId?: string;

  providerId: string;
  modelId: string;
  role?: ModelRole;

  status:
    | "running"
    | "completed"
    | "cancelled"
    | "failed";

  startedAt: string;
  finishedAt?: string;

  usage?: NormalizedUsage;
  cost?: NormalizedCost;
  performance?: NormalizedPerformance;
};
```

Execution records should not contain:

- API keys;
- authorization headers;
- complete provider request payloads;
- complete source files in telemetry;
- hidden reasoning data;
- arbitrary provider-native responses.

## Modes

The workspace supports distinct execution modes.

Initial modes include:

- Build;
- Review;
- Docs.

Modes affect:

- sandbox policy;
- allowed actions;
- task instructions;
- approval requirements;
- expected output.

They do not automatically choose a provider.

### Build

Build may modify files within the authorized workspace and configured sandbox.

Potential actions include:

- creating files;
- editing files;
- running safe commands;
- applying approved changes.

Sensitive or dangerous actions still require policy enforcement and approval.

### Review

Review is read-only.

It may:

- inspect files;
- run safe checks;
- analyze architecture;
- generate suggestions;
- publish evidence.

It may not:

- modify files;
- install packages;
- apply patches;
- escalate permissions.

### Docs

Docs focuses on documentation-related changes.

The documentation-only limitation may remain partly instructional unless a strict file policy is implemented.

It must not be represented as filesystem-enforced if the implementation only instructs the model to modify documentation.

## Git Integration

Git operations belong to the workspace.

The main process may provide:

- status;
- diff;
- branch information;
- commit creation after confirmation;
- file history when supported.

Dangerous actions remain restricted.

Examples include:

- `git push`;
- `git clean`;
- destructive reset;
- force operations.

The presence of a Git repository does not expand workspace authorization.

## Artifacts

An AI execution may produce artifacts.

Examples:

- patches;
- plans;
- reports;
- exported documentation;
- generated files;
- analysis results.

Artifacts belong to:

- a workspace;
- an execution;
- optionally a conversation or session.

Artifacts should preserve provenance:

```text
Generated by
provider + model

During
execution ID

For
workspace ID
```

## Suggestions

Review suggestions belong to the workspace.

They should include:

- title;
- evidence;
- affected files;
- impact;
- benefit;
- complexity;
- risk;
- proposed solution;
- decision state.

Opening a suggestion never modifies the workspace.

Applying a suggestion requires explicit confirmation and starts a separate Build execution.

## Approvals

Approvals are workspace-bound audit events.

They may apply to:

- commands;
- file mutations;
- patches;
- provider actions;
- sensitive operations.

Approval records should identify:

- workspace;
- execution;
- requested operation;
- user decision;
- timestamp;
- risk category.

An approval for one workspace or execution must not silently authorize unrelated future actions.

## Persistence

Workspace persistence is split between:

```text
SQLite

and

<workspace>/.nocturne/
```

### SQLite

Suitable for:

- workspace records;
- conversations;
- messages;
- structured memories;
- provider bindings;
- execution history;
- statistics;
- suggestions;
- approval audit;
- application settings.

### `.nocturne/`

Suitable for:

- versionable project metadata;
- human-readable rules;
- project memory;
- team-shared configuration without secrets.

The application database remains local to the installation.

The `.nocturne/` directory may be versioned with the project when appropriate.

## Import and Export

Workspace export may include:

- metadata;
- conversations;
- messages;
- approved memories;
- candidate memories;
- suggestions;
- non-sensitive AI bindings;
- execution summaries;
- audit records where appropriate.

It must exclude:

- provider secrets;
- API keys;
- authentication tokens;
- system credential references;
- raw secure-store values.

Imported workspaces must require explicit folder reauthorization before protected project operations resume.

## Backup and Restore

Backup and restore should preserve:

- stable workspace identifiers when safe;
- conversation relationships;
- memory lifecycle;
- provider bindings without secrets;
- normalized model catalog snapshots;
- execution metadata;
- schema version.

Restoration must not imply that provider credentials exist on the destination machine.
It also must not imply that a persisted model is currently available. Restored
bindings remain Workspace policy and are resolved again against the active
Registry before execution.

A restored workspace may display:

```text
Provider configured previously

Credentials required on this device
```

## Workspace Deletion

Deleting a workspace record must be explicit.

The interface must clearly distinguish between:

```text
Remove from Nocturne
```

and:

```text
Delete project files
```

Removing a workspace from Nocturne should not delete the project directory.

Filesystem deletion should not be exposed as part of ordinary workspace removal.

## Missing Workspaces

When the root path is unavailable, the workspace enters a recoverable state.

The application may offer:

- locate folder;
- choose replacement path;
- remove from recent workspaces;
- inspect historical conversations;
- export historical data.

It must not silently bind the workspace to another directory with the same name.

## Renamed or Moved Workspaces

When the user selects a new root for an existing workspace, the main process should validate:

- directory existence;
- authorization;
- expected project markers where available;
- `.nocturne/project.json`;
- Git identity or repository metadata when appropriate.

The system should avoid claiming certainty when project identity cannot be verified.

## Multiple Workspaces

Workspaces remain isolated.

By default, one workspace cannot retrieve:

- memories from another workspace;
- files from another workspace;
- provider bindings intended only for another workspace;
- private execution context from another project.

Global provider configurations may be reused.

Project knowledge may not.

## Future Global Knowledge

Cross-workspace or global memory remains outside the current scope.

It introduces questions about:

- privacy;
- relevance;
- conflicting rules;
- project isolation;
- accidental leakage;
- ownership;
- deletion;
- provenance.

Global knowledge should only be introduced after an explicit trust model and evaluation strategy exist.

## UI Responsibilities

The workspace interface should make the following states visible:

- authorized;
- unavailable;
- requires reselection;
- provider not configured;
- model unavailable;
- local provider offline;
- budget warning;
- memory review pending;
- active execution;
- read-only mode.

Status must not rely on color alone.

## Security Rules

A workspace must never:

- expose credentials to the renderer;
- trust renderer-provided paths;
- access another workspace implicitly;
- send the full project to a provider automatically;
- enable dangerous commands through project files;
- treat memories as instructions;
- persist secrets in `.nocturne/`;
- restore provider credentials from ordinary backup.

## Testing

Workspace behavior requires tests for:

- normalized roots;
- path confinement;
- missing directories;
- imported unauthorized workspaces;
- folder reselection;
- cross-workspace isolation;
- provider binding resolution;
- missing provider credentials;
- pagination;
- export without secrets;
- restore without implicit authorization;
- deletion semantics.

Renderer tests should cover visible remediation states.

Main-process tests should enforce actual authorization and isolation.

## Relationship to Other Documents

Read alongside:

- `architecture.md`;
- `architecture/awareness.md`;
- `architecture/second-brain.md`;
- `architecture/execution-pipeline.md`;
- `architecture/ai-provider-system.md`;
- `architecture/ipc.md`;
- `security.md`;
- `review-mode.md`.

## Non-Goals

A workspace is not:

- a container for arbitrary operating-system access;
- a provider account;
- a remote cloud project by default;
- a replacement for Git;
- an automatic knowledge graph;
- a global memory pool;
- an implicit permission grant.

## Summary

The workspace is the stable center of Nocturne Codex.

It owns project identity, knowledge, sessions, configuration, history and authorization.

The Second Brain preserves knowledge.

Awareness selects context.

The AI Orchestrator coordinates execution.

Providers run models.

The workspace connects these systems without becoming dependent on any of them.

> **Projects belong to the user. Providers only assist them.**
