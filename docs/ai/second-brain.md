# Second Brain

> **The Second Brain stores durable, reviewed knowledge for a workspace.**

## Current behavior

The `0.8.0-beta` implementation supports:

- workspace or conversation scope;
- candidate, active, outdated and archived lifecycle;
- manual and agent-proposed candidates;
- explicit approval;
- FTS5 search;
- pagination;
- backup and restore;
- bounded retrieval;
- credential-pattern rejection.

## Separation

- Sessions record what happened.
- Documents remain source material.
- Memories preserve what should remain useful.
- Awareness decides what is relevant now.

## Candidate flow

```text
Manual capture or normalized agent proposal
   ↓
Validation and deduplication
   ↓
Candidate
   ↓
User review
   ↓
Active memory, edit, reject or archive
```

## Non-goals

The current system does not provide global cross-workspace memory, automatic semantic consolidation or silent promotion of conversation content.

## Core rule

> **AI may suggest knowledge. The user decides what becomes memory.**
