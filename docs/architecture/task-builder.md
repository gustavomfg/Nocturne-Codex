# Task Builder

> **The Task Builder converts product intent into a provider-independent task.**

## Inputs

- user instruction;
- workspace identity;
- execution mode;
- Awareness context;
- selected provider or role;
- output requirements;
- tool declarations;
- permission envelope.

## Output

A normalized task contains meaning, not provider-native request fields.

```ts
type NormalizedTask = {
  id: string;
  workspace: { id: string; name: string };
  intent: string;
  mode: "build" | "review" | "docs";
  messages: NormalizedMessage[];
  context: ContextSource[];
  constraints: string[];
  requirements: ModelCapability[];
  tools: ToolDefinition[];
  permissions: PermissionEnvelope;
};
```

The initial executable contract keeps `tools` empty until the normalized Tool
Calling contract and its authorization pipeline are implemented. It does not
accept generic tool objects as a compatibility shortcut.

Tasks carry either an explicit `providerId + modelId`, a workspace role or the
workspace default selection. This is user/workspace intent, not autonomous
model routing.

Initial construction limits include 100 messages, 100 context sources, 100,000
characters per source and 500,000 characters across the selected context.
Review tasks are rejected unless their permission envelope is read-only.

## Rules

- Memories and documents remain labeled as data.
- Task construction does not select secrets.
- Provider prompts may differ internally, but adapters preserve task meaning.
- Context limits are applied before provider compilation.

## Core rule

> **Build one semantic task, then compile it for the chosen provider.**
