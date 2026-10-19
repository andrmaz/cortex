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

1. `pnpm --filter @cortex/api seed:fixture` (creates org `fixture.test`, admin `qa-admin@fixture.test`, department `QA`; idempotent).
2. Set `CORTEX_DEV_LOGIN=true` for the API and seed command (run the API with `NODE_ENV=development`; the endpoint is 404 unless `NODE_ENV` is `development` or `test`; the seed refuses `production`).
3. Open `http://localhost:4000/auth/dev-login`; it signs in only the fixture admin and redirects to the web app with a session.

## Current repo reality

- API test script is currently a placeholder and intentionally fails.
- DB package test script is currently a placeholder and intentionally fails.
- For API/DB changes today, manual verification notes are required until real tests are added.
