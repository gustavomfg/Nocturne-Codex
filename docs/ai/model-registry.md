# Model Registry

> **The registry provides a normalized view of models across providers.**

## Model descriptor

A model descriptor may include:

```ts
type ModelDescriptor = {
  providerId: string;
  modelId: string;
  displayName: string;
  family?: string;
  source: "remote" | "local";
  capabilities: ModelCapability[];
  contextWindow?: number;
  maxOutputTokens?: number;
  pricing?: ModelPricing;
  availability: ModelAvailability;
};
```

Models are identified by the pair `providerId + modelId`.

## Discovery

Models may come from:

- provider APIs;
- local runtime discovery;
- a trusted static catalog;
- manual configuration.

Missing metadata is acceptable. The system must not invent capabilities.

## Pricing

Pricing is time-sensitive metadata. Execution records store the pricing snapshot used for the estimate so history remains explainable.

## Availability

A model can be available, disabled, offline, missing credentials, incompatible or deprecated.

## Workspace bindings

Workspaces bind roles to model references. A user may override the binding for one task.

## Core rule

> **The registry describes models. The orchestrator executes tasks.**
