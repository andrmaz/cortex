# Testing

## Testing principles

- Test observable behavior and contracts, not implementation details.
- Prefer narrow, reproducible verification tied to changed behavior.
- Do not claim tests passed unless you ran them.

## Execution rules

- Run the most relevant lint and type-check commands for affected workspaces.
- If no reliable automated tests exist for changed code, include manual verification steps.

## QA login fixture

Real Google login is unavailable to QA. Seed a fake org and sign in:

1. Export the env vars first, in the same shell for the seed and the API. The seed aborts without `CORTEX_DEV_LOGIN=true` and refuses `NODE_ENV=production`; the login endpoint is 404 unless `NODE_ENV` is `development` or `test`.
   - PowerShell: `$env:CORTEX_DEV_LOGIN = "true"; $env:NODE_ENV = "development"`
   - bash: `export CORTEX_DEV_LOGIN=true NODE_ENV=development`
2. `pnpm --filter @cortex/api seed:fixture` (creates org `fixture.test`, admin `qa-admin@fixture.test`, department `QA`; idempotent).
3. Start the API from the same shell so it sees the same env vars.
4. Open `http://localhost:4000/auth/dev-login`; it signs in only the fixture admin and redirects to the web app with a session.

## Current repo reality

- API, DB, and shared packages use Vitest (pnpm test, or `pnpm --filter <pkg> test`); specs are `*.spec.ts` next to source.
- Use `vi` from `vitest` for mocks; import test APIs explicitly (no globals).

## PostgreSQL retrieval integration tests

The default API suite uses a mock database client. To verify the real
`PrismaService` SQL, run `pnpm --filter @cortex/api test:postgres` against a
PostgreSQL 16 database with pgvector available. Set `DATABASE_URL`, generate the
Prisma client (`pnpm --filter db db:generate`), and apply migrations
(`pnpm --filter db db:migrate:deploy`) first. Use a dedicated test database.
The suite creates uniquely named Organization fixtures and deletes only those
fixtures after each run. CI provisions pgvector and runs this suite explicitly;
it is not skipped when the database is unavailable.
