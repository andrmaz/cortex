# DB Guidance (`packages/db`)

## Context

- Owns Prisma schema and DB client concerns.
- Changes affect organization isolation, policy semantics, retrieval shape, and audit data.

## Schema rules

- Prefer additive, backward-compatible schema changes.
- Keep organization scoping explicit in relational design.
- Add indexes for common auth/retrieval/audit query patterns.

## Verification focus

- Verify practical query behavior, not only schema generation success.
- Include manual verification and rollback notes for schema-impacting changes until migration automation exists.
