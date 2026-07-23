# Artifacts

> **Artifacts are inspectable outputs produced by executions.**

## Examples

- plans;
- patches;
- reports;
- exported documentation;
- generated files;
- structured analysis.

## Provenance

Every artifact links to:

- workspace;
- execution;
- provider and model;
- creation time;
- optional conversation or session.

## Application

Previewing an artifact never applies it. Mutating artifacts, such as patches, require a separate approved operation.

## Storage

Small metadata belongs in SQLite. Large generated files may use controlled application storage or the authorized workspace, depending on type and user intent.

## Core rule

> **An artifact records output; it does not imply application.**
