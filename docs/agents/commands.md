# Commands

Run commands from repo root unless otherwise specified.

## Monorepo commands

- Install dependencies: `pnpm install`
- Dev for all configured workspaces: `pnpm dev`
- Build all configured workspaces: `pnpm build`
- Lint all configured workspaces: `pnpm lint`
- Type-check all configured workspaces: `pnpm check-types`
- Format TS/TSX/MD files: `pnpm format`

## Verified workspace commands

- Web dev: `pnpm --filter @cortex/web dev`
- Web build: `pnpm --filter @cortex/web build`
- Web start: `pnpm --filter @cortex/web start`
- Web lint: `pnpm --filter @cortex/web lint`
- Web type-check: `pnpm --filter @cortex/web check-types`

## Current script gaps

- `apps/api` does not yet provide stable package-local `dev`/`build`/`lint` scripts.
- `packages/db` has no production-ready migration or test automation scripts yet.
- `pnpm --filter @cortex/api test` and `pnpm --filter db test` are placeholder scripts that intentionally fail.
