# Normalization

> **Normalization prevents provider-native concepts from leaking into the product core.**

## Normalized domains

- messages;
- content parts;
- stream events;
- model capabilities;
- tool requests and results;
- usage;
- pricing;
- errors;
- finish reasons;
- approvals.

## Example event set

- `execution.started`
- `message.delta`
- `plan.updated`
- `tool.requested`
- `tool.completed`
- `usage.updated`
- `execution.completed`
- `execution.failed`
- `execution.cancelled`

The initial executable contract covers `execution.started`, `message.delta`,
`usage.updated` and the completed, failed and cancelled terminal events.
Plan and tool events join the same union when their normalized domain contracts
are introduced.

The Orchestrator adds the stable execution identifier, monotonic sequence and
timestamp. Adapters provide validated payloads; they do not control ordering or
terminal state. A stream starts exactly once and rejects every event after its
first terminal event.

Initial limits are 512 characters for normalized identifiers, 100,000
characters per message delta and 4,000 characters for safe error text.

## Error mapping

Adapters map native failures to shared codes such as:

- authentication failed;
- permission denied;
- rate limited;
- model unavailable;
- provider unavailable;
- invalid response;
- timeout;
- cancelled.

## Compatibility

Normalized contracts should evolve additively. Unknown optional fields are ignored safely; incompatible contract changes require versioning and migration.

## Core rule

> **The rest of Nocturne Codex speaks one language, regardless of provider.**
