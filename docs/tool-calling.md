# Tool Calling

> **Tool Calling is the mechanism that allows an AI model to request application capabilities without ever receiving direct authority over the system.**

# Purpose

This document defines how Nocturne Codex exposes tools to language models.

A model may request a tool.

It never executes the tool itself.

All tool execution is controlled by the AI Orchestrator, the security policy and the execution mode.

---

# Philosophy

The provider generates intent.

The application performs authorization.

The trusted runtime executes the operation.

```text
Model

↓

Tool Request

↓

AI Orchestrator

↓

Security Policy

↓

User Approval (if required)

↓

Tool Execution

↓

Normalized Result

↓

Model
```

The model never bypasses this pipeline.

---

# Design Goals

Tool Calling must provide:

- provider independence;
- explicit authorization;
- reproducible execution;
- normalized interfaces;
- auditability;
- sandbox awareness.

---

# Tool Definition

Every tool is described by a normalized contract.

Conceptually:

```ts
type ToolDefinition = {
  id: string;
  name: string;
  description: string;

  inputSchema: unknown;
  outputSchema: unknown;

  permissions: Permission[];

  supportedModes: ExecutionMode[];
};
```

Providers never define application tools.

They only request them.

---

# Tool Lifecycle

```text
Register Tool

↓

Expose Metadata

↓

Model Requests Tool

↓

Validate Arguments

↓

Authorize

↓

Execute

↓

Normalize Output

↓

Return Result
```

---

# Categories

Examples include:

## Workspace

- readFile
- searchFiles
- listDirectory

## Documentation

- searchDocs
- readDocument

## Git

- gitStatus
- gitDiff

## Memory

- searchMemory
- createCandidateMemory

## Terminal

- runCommand
- readProcessOutput

## Review

- createFinding
- exportReport

---

# Authorization

Every tool declares its required permissions.

Examples:

- read
- write
- execute
- network

Execution modes may further restrict access.

---

# Review Mode

Review Mode exposes only read-only tools.

Write-capable tools are unavailable regardless of provider behavior.

---

# Build Mode

Build Mode may expose mutation tools after policy validation.

Sensitive tools may require explicit user approval.

---

# Tool Arguments

Arguments are validated before execution.

Invalid requests fail before reaching the implementation.

Runtime validation is mandatory.

---

# Tool Results

Tool results are normalized.

They may contain:

- structured data;
- diagnostics;
- excerpts;
- execution status.

Results must never contain:

- API keys;
- hidden application state;
- unrestricted filesystem handles.

---

# Errors

Tool failures become normalized errors such as:

- InvalidArguments
- PermissionDenied
- Timeout
- ToolUnavailable
- ExecutionFailed

Provider-native formats are discarded.

---

# Provider Independence

OpenAI function calling, Anthropic tools, Gemini tools and future APIs are translated into the same internal representation.

The renderer and workspace never depend on provider-specific tool formats.

---

# Auditing

Every executed tool may record:

- execution id;
- tool id;
- timestamp;
- duration;
- approval state;
- execution mode;
- success or failure.

Audit data excludes sensitive payloads whenever possible.

---

# Future Evolution

Future versions may support:

- dynamic tool registration;
- provider plugins;
- organization tool packs;
- remote tool execution;
- MCP-compatible adapters.

The authorization model remains unchanged.

---

# Relationship to Other Documents

Read alongside:

- capabilities.md
- providers.md
- model-registry.md
- architecture/execution-pipeline.md
- security.md

---

# Summary

Tool Calling is an authorization pipeline, not merely an API feature.

Models request tools.

The application validates them.

The user retains control.

> **AI may request capabilities. Only Nocturne Codex may execute them.**
