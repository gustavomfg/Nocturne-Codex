# Development

> **This document defines how Nocturne Codex should be developed, extended and maintained without compromising its architecture.**

## Purpose

The goal of this guide is to ensure every contributor follows the same architectural principles.

## Core Principles

1. Workspace before AI
2. Architecture before implementation
3. Provider independence
4. Explicit boundaries
5. Security before convenience

## Development Rules

- Business rules belong to domain modules.
- Renderer never imports provider SDKs.
- Providers are integrated only through adapters.
- IPC is the only bridge between renderer and privileged operations.
- Shared contracts are the public API between processes.

## Provider Development

Adding a new provider should require:

- implementing the provider interface;
- registering the adapter;
- exposing capabilities;
- adding contract tests.

Workspace, Awareness and Second Brain should not change.

## Testing

Every feature should include:

- unit tests;
- integration tests;
- Playwright end-to-end tests when applicable.

## Documentation

Architecture changes require documentation updates.

Documentation is part of the implementation.

## Pull Request Checklist

- Documentation updated.
- Tests passing.
- No provider coupling introduced.
- No secrets committed.
- IPC contracts respected.

## Summary

> **Every contribution should strengthen the workspace while keeping AI providers replaceable.**
