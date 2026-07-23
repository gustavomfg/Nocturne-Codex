# Awareness

> **Awareness selects temporary context. It does not persist knowledge.**

## Sources

- explicit user selections;
- active workspace rules;
- applicable ADRs;
- current documentation;
- approved active memories;
- bounded session state.

## Priority

1. current user instruction;
2. explicit selections;
3. application security and mode;
4. workspace rules;
5. ADRs;
6. current documents;
7. approved memories;
8. recent session context.

Lower-priority sources never override higher-priority authority.

## Retrieval

The initial strategy remains deterministic and inspectable. FTS5 and exact metadata provide the current foundation. Semantic retrieval is postponed until quality and trust can be measured.

## Conflicts

Visible conflicts are surfaced rather than silently resolved when confidence is low.

## Core rule

> **What does this task need to know right now?**
