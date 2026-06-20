# Cursor Cloud

Setup and run caveats for Cursor Cloud agents. The startup update script already
runs `pnpm install` and generates the Prisma client. The notes below cover only
the non-obvious caveats.

## Services

- `@cortex/api` (NestJS, port 4000) — core product (MCP entrypoint + auth). Needs Postgres + env vars.
- `@cortex/web` (Next.js, port 3000) and `@cortex/docs` (port 3001) — run cleanly via `pnpm --filter @cortex/web dev` / `--filter @cortex/docs dev`. Currently default Turborepo starter pages.
- Standard commands (`pnpm lint|check-types|build|test|dev`) are in [`commands.md`](./commands.md). All pass.

## PostgreSQL (installed natively, not Docker)

- `docker`/`docker-compose` are NOT available; Postgres 16 is installed via apt instead. Data, the `cortex` role/db, and the applied schema persist in the VM snapshot.
- Start it (not auto-started on boot): `sudo pg_ctlcluster 16 main start`.
- Connection (matches [`../../docker-compose.yml`](../../docker-compose.yml)): `postgresql://cortex:cortex@localhost:5432/cortex`.

## Environment variables

- The API reads `process.env` directly (no dotenv autoload). Export vars before running: `set -a; . /workspace/.env; set +a`.
- `/workspace/.env` exists (gitignored, persists in snapshot) with dev values for `DATABASE_URL` and `JWT_SECRET`. `JWT_SECRET` is required or `@cortex/api` fails to boot.

## Migrations (Prisma 7 config gotcha)

- `prisma migrate deploy` / `db:migrate` fail with "datasource.url property is required": [`../../packages/db/prisma.config.ts`](../../packages/db/prisma.config.ts) uses `env["DATABASE_URL"]` which does not resolve from `process.env` in Prisma 7.
- The committed migration SQL has already been applied to the DB. To re-apply on a fresh DB, run the files in `../../packages/db/prisma/migrations/*/migration.sql` directly with `psql`.

## Running the API end-to-end (known gaps as committed)

The API builds, type-checks, lints, and its 53 jest tests pass, but it cannot be booted by the committed scripts as-is:

- [`../../apps/api/tsconfig.json`](../../apps/api/tsconfig.json) `paths` map `db/client` to a `.ts` source file; `nest build`/`nest start` emit a require to that `.ts`, so `node dist/...` and `nest start --watch` fail (this is the "dev/build not stable yet" note in [`commands.md`](./commands.md)). The runnable compiled entry is `apps/api/dist/apps/api/src/main.js`, not `dist/main.js`.
- The Prisma 7 client needs a driver adapter (`@prisma/adapter-pg`), but `PrismaService` constructs `PrismaClient()` with no adapter, so it throws at boot.

Fully running the API therefore requires small code/config fixes (wire `@prisma/adapter-pg` into `PrismaService`, correct the `db` package paths/exports). Until then, prefer the unit tests and the web/docs apps for verification.

## Tests

- `pnpm test` passes (`@cortex/shared` 21, `@cortex/api` 53). The "API/DB test scripts intentionally fail" note in [`testing.md`](./testing.md) is outdated for `@cortex/api`; `db` simply has no `test` script.
- API tests mock `db/client` ([`../../apps/api/src/__mocks__/db-client.mock.ts`](../../apps/api/src/__mocks__/db-client.mock.ts)), so they need no database.
