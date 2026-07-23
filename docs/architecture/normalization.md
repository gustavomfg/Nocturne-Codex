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
