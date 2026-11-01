# Department Policies

Policies are Organization-owned, versioned Department configurations. Admins
manage them at `/admin/policies`.

## Admin API

All endpoints require an Admin session. Organization scope comes from the JWT,
never the body. Departments and exact Source IDs must belong to that Organization.

| Method | Route                                | Behavior                                                                     |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------- |
| GET    | `/api/admin/policies`                | List your Organization's versions                                            |
| GET    | `/api/admin/policies/:id`            | Read one scoped version                                                      |
| POST   | `/api/admin/policies`                | Create an **inactive** version with `{ departmentId, rulesJson }`            |
| PATCH  | `/api/admin/policies/:id`            | Replace an inactive version's validated `{ rulesJson }`                      |
| DELETE | `/api/admin/policies/:id`            | Delete an inactive version; 204                                              |
| POST   | `/api/admin/policies/:id/activate`   | Atomically deactivate other versions in its Department and activate this one |
| POST   | `/api/admin/policies/:id/deactivate` | Deactivate this version                                                      |

Active versions cannot be edited or deleted (409). Create a new version for a
non-disruptive policy change, or explicitly deactivate before editing/deleting.
Creating does not change the active version. Concurrent mutations serialize on
the scoped Department row; PostgreSQL additionally enforces at most one active
version per `(organization_id, department_id)` via a partial unique index.
Version numbers are allocated from the highest remaining version plus one.
Deleting the highest inactive version can allow that number to be reused;
this API is draft management, not an immutable audit-history contract.

Invalid JSON, unknown fields, duplicate rule/source IDs, unsupported schema/effects,
wrong condition/effect combinations, missing reasons and foreign/missing Source
references are rejected before persistence. Activation revalidates rules and
Source references. The editor validates syntax/shape locally and displays API
validation, lifecycle conflicts, and network failures without false success.

## Rule document

```json
{
  "schemaVersion": 1,
  "allowedSourceIds": ["source-id-in-your-organization"],
  "rules": [
    {
      "id": "deny-compensation",
      "when": { "queryContains": "salary" },
      "effect": "deny",
      "reasonCode": "COMPENSATION_DENIED",
      "reason": "Compensation access is restricted."
    },
    {
      "id": "mask-secret",
      "when": { "chunkContentContains": "secret" },
      "effect": "redact",
      "replacement": "[REDACTED]"
    }
  ]
}
```

Each condition is exactly one of `queryContains` or `chunkContentContains`.
Matching is literal, locale-independent ECMAScript case-insensitive substring matching, not a regex or an
executable expression. Deny requires an uppercase machine code
(`[A-Z][A-Z0-9_]*`) and a human message. Redact only supports Chunk content
conditions and requires a literal replacement (empty means deletion; `$&`
is literal text). There is no explicit allow effect or metadata predicate.
Limits: 100 rules, 1000 Source IDs, 1000 characters per condition/message/replacement,
100 per rule ID/reason code, and 200 per Source ID.

## Migration and verification

Migration `0007_single_active_policy` adds the partial unique index and changes
the default to inactive. It intentionally fails on duplicate legacy active
versions rather than silently selecting one. Before deploying to an existing
database, inspect duplicate active scopes and have an Admin explicitly select
the intended active version. No legacy rows are automatically deleted/rewritten.
Rollback (only under approved database operations): drop
`policies_one_active_per_department` and restore the old `is_active` default;
doing so removes the concurrency backstop and requires rolling back callers too.

Focused checks:

- `pnpm --filter @cortex/shared build` before package-local API/Web builds or
  tests; the `/policy` subpath exports compiled JavaScript for API and Web consumers.
- `pnpm --filter @cortex/shared test`: strict schema boundaries.
- `pnpm --filter @cortex/api test:postgres`: real admin HTTP CRUD,
  validation-before-persistence, role/Organization isolation, concurrent version
  allocation/activation, and index enforcement. Uses unique fixtures and deletes
  only them.
- `pnpm --filter @cortex/web test`: editor syntax/shape and action feedback.
- API/Web/shared/DB type checks, affected lint, and Web production build.

The browser walkthrough should select a Department, submit malformed JSON and
invalid rules, grant an existing Source ID, create/edit a draft, activate another
version, deactivate and confirm deletion, and verify pending/error feedback.
