# ADR-004: Enforced Review Mode

## Status

Accepted

## Context

Prompt-only instructions cannot guarantee read-only analysis.

## Decision

Review Mode is enforced by sandbox and execution policy. Applying a suggestion starts a separate Build execution.

## Consequences

The workflow is safer but may require an additional confirmation step.
