# AGENTS

Cortex is a TypeScript monorepo for an MCP-first context, policy, and audit platform.

## Essentials

- Package manager: `pnpm` (workspace root).
- Monorepo task runner: Turborepo via root scripts.
- Non-standard command names:
  - Type-check all workspaces: `pnpm check-types`
  - Format markdown/typescript files: `pnpm format`
- Closest `AGENTS.md` in the directory tree takes precedence.

## Progressive Disclosure

- Core guidance index: [`docs/agents/README.md`](docs/agents/README.md)
- Commands: [`docs/agents/commands.md`](docs/agents/commands.md)
- Code style: [`docs/agents/code-style.md`](docs/agents/code-style.md)
- Testing: [`docs/agents/testing.md`](docs/agents/testing.md)
- Security: [`docs/agents/security.md`](docs/agents/security.md)
- Git and PR workflow: [`docs/agents/git-workflow.md`](docs/agents/git-workflow.md)
- End-to-end issue delivery: [`docs/agents/sdlc.md`](docs/agents/sdlc.md)
- Cursor Cloud setup and run caveats: [`docs/agents/cursor-cloud.md`](docs/agents/cursor-cloud.md)
- Deletion candidates audit: [`docs/agents/deletion-candidates.md`](docs/agents/deletion-candidates.md)
- Fallow codebase audits, cleanup, and PR review: [`docs/agents/fallow.md`](docs/agents/fallow.md)

## Agent Skills

### Issue delivery

Use the `issue-sdlc` skill when asked to take an existing GitHub issue through implementation and pull request delivery. Issues labeled `ready-for-agent` skip Planning through Design; see [`docs/agents/sdlc.md`](docs/agents/sdlc.md).

### Issue tracker

Issues and specifications live in GitHub Issues. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md). Triage state labels and `/triage` readiness live in [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Use the single-context glossary and ADR layout. See [`docs/agents/domain.md`](docs/agents/domain.md).
