# Awareness

> **Awareness is the temporary context-selection system of Nocturne Codex. It determines what the current task needs to know without changing persistent knowledge.**

---

# Purpose

Awareness exists to assemble the smallest useful context for an AI task.

It connects the workspace knowledge to the execution pipeline while preserving a strict separation between:

- persistent knowledge;
- temporary context;
- user intent;
- provider execution.

Awareness does not remember.

Awareness selects.

---

# Core Principle

The Second Brain stores knowledge.

Awareness decides what knowledge is relevant now.

```text
Second Brain

↓

Awareness

↓

Task Context

↓

AI Execution
```

This distinction is fundamental.

Persistent storage and contextual selection must never become the same responsibility.

---

# Responsibilities

Awareness is responsible for:

- identifying the active workspace;
- understanding the current task;
- retrieving relevant approved memories;
- selecting useful project documents;
- including applicable architecture decisions;
- collecting temporary session context;
- respecting context and size limits;
- classifying every selected source;
- producing a normalized context package.

Awareness is not responsible for:

- executing providers;
- storing permanent memories;
- modifying workspace files;
- approving candidate knowledge;
- deciding which model should run;
- persisting provider responses.

---

# Architectural Position

```text
Workspace
   │
   ├── Documents
   ├── Approved Memories
   ├── Architecture Decisions
   ├── Rules
   └── Session Context
            │
            ▼
        Awareness
            │
            ▼
   Normalized Context Package
            │
            ▼
        Task Builder
```

Awareness sits between workspace knowledge and task construction.

---

# Input Sources

Awareness may select context from multiple sources.

## Workspace Metadata

Examples:

- workspace name;
- root path;
- detected stack;
- project commands;
- active branch;
- project configuration.

Workspace metadata should remain compact and factual.

---

## Second Brain

Only approved and active memories are eligible.

Candidates, archived memories and outdated entries are excluded unless the user explicitly requests them.

Selected memories must retain metadata identifying:

- source;
- scope;
- confidence;
- lifecycle state;
- last update.

---

## Project Documents

Examples:

- README;
- architecture documentation;
- contribution guides;
- design system;
- security policies;
- roadmap;
- local project documentation.

Awareness should prefer focused excerpts over complete documents whenever possible.

---

## Architecture Decisions

Relevant ADRs may be included when the current task could affect an established decision.

An ADR is not merely reference material.

It represents an architectural constraint unless explicitly superseded.

---

## Workspace Rules

Examples:

- coding conventions;
- allowed commands;
- formatting expectations;
- project-specific constraints;
- prohibited operations.

Rules are distinct from memories because they may influence execution behavior.

---

## Current Session

Temporary session context may include:

- recent user instructions;
- current plan;
- pending approvals;
- files already inspected;
- unresolved errors;
- current execution state.

Session context is never promoted into long-term knowledge automatically.

---

## User Selection

The user may explicitly select:

- files;
- folders;
- memories;
- documents;
- diffs;
- suggestions.

Explicit user selection has higher priority than automatic retrieval, while still respecting security and size limits.

---

# Context Package

Awareness produces a normalized context package.

Conceptually:

```ts
type AwarenessContext = {
  workspace: {
    id: string;
    name: string;
    rootPath: string;
  };

  task: {
    intent: string;
    mode: "build" | "review" | "docs";
  };

  sources: AwarenessSource[];

  constraints: string[];

  limits: {
    estimatedTokens?: number;
    maxCharacters?: number;
    maxSources?: number;
  };
};
```

A source should preserve provenance:

```ts
type AwarenessSource = {
  id: string;
  type:
    | "memory"
    | "document"
    | "adr"
    | "rule"
    | "session"
    | "user-selection";

  title: string;
  content: string;
  scope: string;
  relevance?: number;
  updatedAt?: string;
  potentiallyOutdated: boolean;
};
```

Provider-specific payloads do not belong here.

---

# Context Classification

Every selected item must be classified before entering the task.

The system must distinguish between:

- user instruction;
- workspace rule;
- approved memory;
- project documentation;
- historical session data;
- provider output.

This prevents remembered information from being interpreted as a new command.

---

# Trust Model

Awareness treats retrieved knowledge as data.

Approved does not mean permanently correct.

A memory may be valid, outdated or incomplete.

Therefore, contextualized memories must be marked as:

- approved;
- potentially outdated;
- non-authoritative unless backed by a current rule or ADR;
- unable to expand permissions.

No retrieved content may:

- grant filesystem access;
- enable commands;
- change execution mode;
- override the current user request;
- alter sandbox restrictions.

---

# Relevance

Awareness should select context according to relevance, not volume.

A useful context package is:

- focused;
- attributable;
- bounded;
- understandable;
- sufficient for the task.

More context is not automatically better context.

Excessive context may:

- increase cost;
- reduce model attention;
- introduce conflicting information;
- expose unrelated project data;
- make execution less predictable.

---

# Retrieval Strategy

The initial retrieval strategy should remain deterministic and inspectable.

Possible stages:

```text
1. Resolve workspace and conversation scope
2. Read explicit user selections
3. Identify task keywords and intent
4. Retrieve matching approved memories
5. Retrieve relevant documents and ADRs
6. Apply limits and deduplication
7. Produce the normalized context package
```

Semantic retrieval may be introduced later, but it must not replace transparent source attribution.

---

# Priority Order

A reasonable priority order is:

1. Current user instruction
2. Explicit user-selected sources
3. Active workspace rules
4. Applicable ADRs
5. Current project documents
6. Approved memories
7. Recent session context
8. Optional low-confidence supporting context

Lower-priority context must never override higher-priority instructions.

---

# Limits

Awareness must enforce bounded context.

Limits may include:

- maximum number of memories;
- maximum characters;
- maximum estimated tokens;
- maximum items per source type;
- maximum document excerpt size.

Current production limits should be documented with the implementation and covered by regression tests.

Limits exist for:

- privacy;
- performance;
- cost control;
- model quality;
- provider compatibility.

---

# Deduplication

Context may be duplicated across:

- documentation;
- memories;
- session messages;
- ADRs.

Awareness should deduplicate semantically equivalent or identical content whenever possible.

The source with the highest authority should be preserved.

For example:

```text
ADR

overrides duplicate memory
```

```text
Current documentation

overrides outdated session summary
```

---

# Conflict Detection

Awareness should detect visible conflicts.

Examples:

- an approved memory contradicts a newer ADR;
- a project document conflicts with a workspace rule;
- two memories describe different current states;
- session context references a removed file.

Conflicts should not be silently resolved when confidence is low.

Instead, the context package should identify them explicitly.

---

# Provider Independence

Awareness never knows:

- provider API formats;
- model identifiers;
- streaming protocols;
- pricing;
- authentication;
- tool-call schemas.

It produces the same normalized context regardless of whether execution uses:

- Codex CLI;
- OpenAI;
- OpenRouter;
- Ollama;
- LM Studio;
- another future provider.

Provider adapters may compile the normalized task differently, but they may not change the meaning of the selected context.

---

# Interaction with the Task Builder

Awareness selects information.

The Task Builder organizes that information into an executable task.

```text
Awareness

produces

Context Package

↓

Task Builder

combines

Intent + Context + Mode + Output Contract
```

This separation keeps retrieval independent from prompt construction.

---

# Interaction with the Second Brain

The relationship is one-way during context preparation:

```text
Second Brain

↓

Awareness
```

Awareness never edits memories.

After execution, a separate memory-candidate workflow may analyze the normalized response and propose durable knowledge for user review.

That workflow does not belong to Awareness.

---

# Interaction with Sessions

Awareness may read bounded session context.

It does not treat the entire conversation history as automatically relevant.

The system should prefer:

- current objective;
- unresolved decisions;
- recent important actions;
- explicit user corrections.

Long histories should be paginated or summarized through controlled mechanisms rather than blindly attached.

---

# Observability

Awareness should be explainable.

The user should be able to understand:

- which sources were selected;
- why they were selected;
- which sources were excluded;
- whether any source may be outdated;
- how much context was sent;
- whether limits caused truncation.

Future interfaces may expose a compact context inspector.

Transparency is more important than invisible retrieval sophistication.

---

# Privacy

Awareness must operate within the authorized workspace.

It must never retrieve:

- files outside the workspace boundary;
- memories belonging to another unauthorized workspace;
- credentials;
- ignored binary content;
- unrelated global information.

Cross-workspace retrieval remains out of scope until an explicit trust and permission model exists.

---

# Failure Modes

Awareness should fail safely.

Examples:

## No Relevant Context

The task may continue with the user instruction alone if the operation does not require project knowledge.

---

## Context Limit Reached

The system should truncate deterministically and record that truncation occurred.

---

## Conflicting Sources

The conflict should be surfaced instead of silently choosing an uncertain interpretation.

---

## Unauthorized Workspace

Context retrieval must stop.

Historical conversation metadata may remain visible, but protected project knowledge must not be accessed.

---

## Invalid Memory Data

The invalid entry should be excluded without discarding the entire task.

---

# Future Evolution

Possible future improvements include:

- embeddings;
- semantic search;
- relationship-aware retrieval;
- context quality scoring;
- retrieval evaluation datasets;
- source freshness policies;
- task-specific retrieval profiles;
- context caching;
- user-defined retrieval rules.

These capabilities should only be introduced with measurable gains in quality and clear trust boundaries.

---

# Non-Goals

Awareness is not intended to:

- create autonomous long-term plans;
- silently maintain project state;
- replace documentation;
- infer permanent truth from conversations;
- decide permissions;
- choose providers based on hidden heuristics;
- send the entire workspace to a model.

---

# Summary

Awareness is the temporary intelligence layer between workspace knowledge and AI execution.

It answers one question:

> **What does this task need to know right now?**

The Second Brain preserves knowledge.

Awareness selects knowledge.

The Task Builder structures knowledge.

The provider executes the task.

Keeping these responsibilities separate is essential to the architecture of Nocturne Codex.
