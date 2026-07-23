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
  intent: string;
  mode: "build" | "review" | "docs";
  messages: NormalizedMessage[];
  context: ContextSource[];
  requirements: ModelCapability[];
  tools: ToolDefinition[];
  permissions: PermissionEnvelope;
};
```

## Rules

- Memories and documents remain labeled as data.
- Task construction does not select secrets.
- Provider prompts may differ internally, but adapters preserve task meaning.
- Context limits are applied before provider compilation.

## Core rule

> **Build one semantic task, then compile it for the chosen provider.**
