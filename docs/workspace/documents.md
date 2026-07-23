# Documents

> **Project documents remain source material with explicit provenance.**

## Sources

Documents may include README files, architecture guides, ADRs, security policy, design system, roadmap and contributor documentation.

## Source of truth

The filesystem is the source of truth. SQLite stores metadata or indexes needed for search and retrieval.

## Retrieval

Awareness selects focused excerpts rather than attaching complete documents by default.

Each excerpt preserves:

- path;
- title;
- type;
- update time;
- source range where available.

## ADR handling

Active ADRs have higher authority than ordinary memories. Superseded ADRs remain historical and must be marked.

## Core rule

> **Documents inform tasks; they are not silently rewritten into memory.**
