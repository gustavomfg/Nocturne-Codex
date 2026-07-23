# Provider System Overview

> **Bring your own AI while keeping the same workspace.**

## Provider definition

A provider is an execution backend connected to Nocturne Codex through an adapter.

Examples:

- Codex CLI;
- OpenAI;
- OpenRouter;
- DeepSeek;
- Anthropic;
- Ollama;
- LM Studio;
- compatible custom endpoints.

No provider is mandatory.

## Global configuration and workspace use

Provider configurations are application-level resources. Workspaces reference them through model bindings.

This allows one configured provider to serve several workspaces without copying credentials.

## Local and remote

Remote providers send selected context over the network.

Local providers execute through endpoints such as Ollama or LM Studio. Local does not mean inherently trusted; normal validation and limits still apply.

## User-visible behavior

The user should be able to:

- add, edit, disable and remove providers;
- test connectivity;
- inspect discovered models;
- see local or remote status;
- choose workspace defaults and role bindings;
- view usage, cost and errors.

## Initial implementation strategy

Start with:

1. a generic OpenAI-compatible adapter;
2. Codex CLI as an adapter over App Server;
3. Ollama;
4. LM Studio through compatibility where sufficient.

Add dedicated adapters only when provider-specific capabilities justify them.

## Core rule

> **Provider choice changes execution, not workspace behavior.**
