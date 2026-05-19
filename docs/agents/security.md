# Security

## Sensitive data

- Never commit secrets (`.env*`, tokens, private keys).
- Treat organization-scoped query/context/audit data as sensitive by default.

## Isolation and access

- Preserve organization isolation across API retrieval, policy evaluation, and audit reads/writes.
- Avoid exposing sensitive payloads in browser logs or debug output.

## Database safety

- Do not run destructive Prisma/database operations without explicit user approval.
- Keep policy-deny/redaction behavior auditable when touching API/DB logic.
