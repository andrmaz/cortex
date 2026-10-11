# Git Workflow

## Commit format

- Use Conventional Commits:
  - `feat: ...`
  - `fix: ...`
  - `chore: ...`
  - `docs: ...`
  - `refactor: ...`
  - `test: ...`
- Scope is recommended when useful, e.g. `feat(api): add mcp auth guard`.
- Enforced locally by [commitlint](https://commitlint.js.org/) via the Husky `commit-msg` hook (`pnpm install` installs the hook through the root `prepare` script).
- Config lives in [`commitlint.config.js`](../../commitlint.config.js) and extends `@commitlint/config-conventional`.
- To check a message without committing: `echo "feat: example" | pnpm exec commitlint`.

## Commit quality

- Keep commits small and single-purpose.
- Align commit message with why the change exists.

## PR expectations

- Include:
  - what changed
  - why it changed
  - test/verification evidence
  - risk/rollback notes when relevant
