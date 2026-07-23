# Conversations

> **Conversations organize messages and executions, but they are not permanent knowledge.**

## Ownership

Every conversation belongs to one workspace.

## Contents

A conversation may contain:

- user and assistant messages;
- provider and model attribution;
- linked execution records;
- artifacts;
- approvals;
- candidate memories.

## Persistence

Messages are paginated. Provider-native payloads and hidden reasoning are not persisted.

Technical memory-candidate blocks are removed before visible message persistence.

## History

A conversation may outlive the provider or model that created its responses. Historical attribution remains normalized and readable.

## Core rule

> **Conversations preserve interaction history; the Second Brain preserves approved knowledge.**
