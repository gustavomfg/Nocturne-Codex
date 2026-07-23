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
Provider discovery replaces only that Provider's catalog, and only after every
descriptor passes normalized validation. A failed or superseded refresh
preserves the last valid catalog.

The last valid normalized snapshot is persisted locally. Startup may hydrate
the in-memory Registry from that snapshot before a new discovery, without
treating persisted availability as a successful live health check.

## Pricing

Pricing is time-sensitive metadata. Execution records store the pricing snapshot used for the estimate so history remains explainable.

## Availability

A model can be available, disabled, offline, missing credentials, incompatible or deprecated.

## Workspace bindings

Workspaces bind roles to model references. A user may override the binding for one task.
Bindings are persisted as Workspace policy and may remain unresolved when a
Provider or model is unavailable. Resolution must surface that state; it must
not silently replace the user's selection.

## Core rule

> **The registry describes models. The orchestrator executes tasks.**
