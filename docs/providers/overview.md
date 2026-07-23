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

An adapter implementation does not register or connect a Provider by itself.
The default Provider Registry starts empty and receives only configurations
that the user explicitly creates. Codex CLI is not part of the curated
connection catalog and is not registered automatically.

## Global configuration and workspace use

Provider configurations are application-level resources. Workspaces reference them through model bindings.

This allows one configured provider to serve several workspaces without copying credentials.

## Local and remote

Remote providers send selected context over the network.

Local providers execute through endpoints such as Ollama or LM Studio. Local does not mean inherently trusted; normal validation and limits still apply.

## User-visible behavior

The user should be able to:

- start from a curated company catalog instead of entering protocol details;
- see which connection methods are actually supported;
- add, edit, disable and remove providers;
- test connectivity;
- inspect discovered models;
- see local or remote status;
- choose workspace defaults and role bindings;
- view usage, cost and errors.

The catalog is onboarding metadata, not execution authority. A preset may
produce a validated draft only when an implemented adapter supports its
protocol. Account subscriptions must not be presented as API access unless the
Provider exposes an official account authorization flow implemented by
Nocturne. Custom OpenAI-compatible configuration remains an advanced option.

## Initial implementation strategy

Start with:

1. a generic OpenAI-compatible adapter;
2. Codex CLI as an isolated compatibility adapter over App Server;
3. Ollama;
4. LM Studio through compatibility where sufficient.

The Codex compatibility adapter remains inactive outside its legacy
compatibility flow until an explicit, user-controlled connection lifecycle is
implemented for it.

Add dedicated adapters only when provider-specific capabilities justify them.

## Core rule

> **Provider choice changes execution, not workspace behavior.**
