# Workspace Lifecycle

> **Workspace history and filesystem authority have separate lifecycles.**

## States

- authorized;
- missing;
- requires reselection;
- unavailable;
- archived;
- removed from Nocturne.

## Creation

The user selects a folder. The main process normalizes and authorizes the root, creates the database record and reads optional `.nocturne/` metadata.

## Reopening

Historical records load from SQLite. Filesystem operations resume only when the root remains valid and authorized.

## Import

Imported history does not grant access to the original path. The user must select the folder again.

## Move or rename

The user may relink an existing workspace after validation. Nocturne must not silently bind by folder name alone.

## Removal

“Remove from Nocturne” deletes the application record according to product policy, not project files. Filesystem deletion is not part of ordinary removal.

## Core rule

> **A known workspace is not automatically an authorized workspace.**
