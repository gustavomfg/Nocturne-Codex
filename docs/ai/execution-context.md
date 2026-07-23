# Execution Context

> **Execution Context is the bounded, attributable information sent with one task.**

## Contents

A context package may include:

- workspace metadata;
- current user instruction;
- explicit file selections;
- project rules;
- applicable ADRs;
- document excerpts;
- approved memories;
- bounded recent session state;
- execution mode and permissions.

## Classification

Every source is labeled as instruction, rule, ADR, document, memory, session data or user selection.

Approved memory remains potentially outdated data. It cannot override the current user request or expand permissions.

## Limits

Context is bounded by source count, characters and estimated tokens. Provider context windows influence compilation, not retrieval authority.

## Transparency

The user should eventually be able to inspect selected sources, exclusions, truncation and estimated context size.

## Core rule

> **Send the smallest context that is sufficient, attributable and authorized.**
