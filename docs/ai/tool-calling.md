# Tool Calling

> **Models request tools; Nocturne Codex authorizes and executes them.**

## Tool contract

A tool definition includes:

- stable identifier;
- description;
- input schema;
- result schema;
- required permissions;
- supported modes;
- timeout and output limits.

## Flow

```text
Model tool request
   ↓
Adapter normalization
   ↓
Argument validation
   ↓
Execution policy
   ↓
User approval when required
   ↓
Trusted tool service
   ↓
Bounded normalized result
   ↓
Provider
```

## Mode behavior

Review exposes read-only tools. Build may expose mutation tools under workspace confinement and approval policy. Docs exposes documentation-focused behavior without claiming enforcement that does not exist.

## Security

Tool output is untrusted data and may contain injection or credentials. It is bounded, sanitized where appropriate and never grants new authority.

## Audit

Tool executions record identifiers, timing, mode, approval state and status without preserving unnecessary sensitive content.

## Core rule

> **Tool calling is an authorization pipeline, not direct model access to the system.**
