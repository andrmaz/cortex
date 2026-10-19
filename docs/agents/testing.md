# Testing

## Testing principles

- Test observable behavior and contracts, not implementation details.
- Prefer narrow, reproducible verification tied to changed behavior.
- Do not claim tests passed unless you ran them.

## Execution rules

- Run the most relevant lint and type-check commands for affected workspaces.
- If no reliable automated tests exist for changed code, include manual verification steps.

## Current repo reality

- API, DB, and shared packages use Vitest (pnpm test, or `pnpm --filter <pkg> test`); specs are `*.spec.ts` next to source.
- Use `vi` from `vitest` for mocks; import test APIs explicitly (no globals).
