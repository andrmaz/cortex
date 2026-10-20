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
