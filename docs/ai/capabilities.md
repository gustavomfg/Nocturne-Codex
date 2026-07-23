# Capabilities

> **Tasks depend on capabilities, not vendor names.**

## Initial capability set

- `chat`
- `streaming`
- `tool-calling`
- `vision`
- `structured-output`
- `reasoning`
- `embeddings`

Capabilities may include normalized metadata such as supported image formats, tool limits or structured-output constraints.

## Resolution

```text
Task requirements
   ↓
Model Registry
   ↓
Compatible model candidates
   ↓
Workspace policy and user choice
   ↓
Execution
```

If no compatible model exists, execution stops before contacting a provider.

## Rules

- Capabilities are declared or discovered; never assumed.
- A provider may expose only a subset.
- UI features must degrade clearly when unsupported.
- Provider-specific features require a normalized capability before becoming core behavior.

## Future capabilities

Audio, browsing, computer use, image generation and other features may be added later without changing existing contracts.

## Core rule

> **Ask what the model can do, not which company provides it.**
