# Review Mode

> **Review Mode allows Nocturne Codex to inspect, understand and critique a project without ever modifying it. It is a security boundary, not just a different prompt.**

# Purpose

Review Mode exists to help developers understand the current state of a project while guaranteeing that the execution remains read-only.

Unlike Build Mode, Review Mode is designed for analysis rather than modification.

Typical tasks include:

- architecture reviews;
- code quality analysis;
- bug investigation;
- security audits;
- performance inspection;
- documentation review;
- dependency analysis;
- technical debt discovery.

---

# Design Goals

Review Mode must provide:

- deep project understanding;
- zero file modifications;
- transparent evidence;
- reproducible analysis;
- provider-independent behavior.

---

# Core Principle

Review Mode may **observe**.

It may **never mutate**.

```text
Workspace

↓

Read files

↓

Analyze

↓

Generate findings

↓

Return suggestions

✓ No writes
✓ No patches
✓ No commands that mutate the project
```

---

# Security Model

Review Mode is enforced by the application, not by the language model.

The provider receives instructions describing the mode, but the main process must also enforce read-only behavior.

The model cannot elevate its own permissions.

---

# Allowed Operations

Examples of permitted actions:

- read project files;
- inspect documentation;
- read Git status;
- inspect diffs;
- search symbols;
- analyze architecture;
- compare implementations;
- generate reports;
- propose improvements.

---

# Forbidden Operations

Review Mode must never:

- modify files;
- create files;
- delete files;
- rename files;
- install dependencies;
- execute mutating shell commands;
- apply patches;
- commit changes;
- push to Git;
- alter the Second Brain automatically.

---

# Execution Flow

```text
User

↓

Review Mode

↓

Awareness

↓

Task Builder

↓

AI Orchestrator

↓

Provider

↓

Normalized Findings

↓

Renderer
```

The execution pipeline remains identical to other modes.

Only the permission policy changes.

---

# Findings

Review Mode produces findings instead of edits.

A finding should contain:

- title;
- description;
- evidence;
- affected files;
- severity;
- rationale;
- suggested improvement.

Suggestions are recommendations.

They are never applied automatically.

---

# Evidence

Every significant conclusion should be supported by evidence.

Examples:

- file paths;
- code excerpts;
- architectural references;
- documentation;
- ADRs;
- dependency metadata.

The goal is to help developers verify conclusions independently.

---

# Interaction with the Second Brain

Review Mode may read approved memories.

It may suggest new candidate memories.

It may never approve or modify memories automatically.

---

# Interaction with Providers

All providers participate through the same normalized execution pipeline.

No provider receives additional authority because Review Mode is active.

The mode affects permissions, not provider behavior.

---

# Reports

Review Mode may generate structured reports, including:

- architecture review;
- security assessment;
- documentation coverage;
- dependency health;
- maintainability summary;
- code smells;
- performance observations.

Reports are artifacts.

They do not modify the project.

---

# Relationship with Build Mode

Review Mode answers:

> "What should change?"

Build Mode answers:

> "Apply the approved change."

Keeping these responsibilities separate improves safety and transparency.

---

# Testing

Review Mode should be tested to ensure:

- write operations are rejected;
- provider responses cannot bypass policy;
- reports remain reproducible;
- suggestions never modify files;
- approvals are not requested for prohibited operations.

---

# Future Evolution

Potential improvements include:

- architecture scoring;
- project health dashboards;
- trend analysis across sessions;
- configurable review profiles;
- organization-wide review policies.

These additions must preserve the read-only guarantee.

---

# Summary

Review Mode is an inspection environment.

It helps developers understand their software without risking unintended modifications.

> **Understand first. Change later.**
