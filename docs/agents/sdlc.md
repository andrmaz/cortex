# Software Development Lifecycle

Use this lifecycle when a user asks an agent to take an existing issue through implementation and pull request delivery. The issue is the durable specification; do not create a duplicate issue.

## Entry

1. Fetch the complete issue, comments, and labels using [`issue-tracker.md`](./issue-tracker.md).
2. Read the closest `AGENTS.md`, the relevant domain docs, and the code around the requested behavior.
3. Confirm that the issue is actionable from repository evidence. Ask the user only when a missing product decision would materially change the result.

## Phases and gates

### Planning

Use `/to-spec` as the planning standard. Treat an actionable existing issue as the specification instead of publishing a duplicate; when work starts from a conversation without an issue, use the skill to publish one.

**Gate:** the problem, acceptance criteria, scope, and verification surface are explicit.

### Analysis

Explore existing behavior and prior art before selecting a solution. Use `/grill-with-docs` when genuine ambiguity needs stakeholder decisions; record resolved domain language or durable architecture decisions as directed by the skill.

**Gate:** the root cause or capability gap is supported by evidence, and remaining assumptions are explicit.

### Design

Use `/codebase-design` when the change introduces or alters a module interface or seam. Prefer an existing seam and the smallest design that hides the required complexity.

**Gate:** ownership, interfaces, and test seams are clear without speculative abstractions.

### Coding

Use `/implement` to execute the issue. Use `/tdd` at the chosen seams where a failing test can demonstrate the missing behavior. Keep unrelated changes out of the diff.

**Gate:** every in-scope requirement is implemented and focused tests pass.

### Testing

Apply `/code-review` against the complete working tree and the branch's merge base, including staged and untracked files, using the issue as the specification. Resolve material findings, then run the repository checks described in [`testing.md`](./testing.md) and [`commands.md`](./commands.md).

**Gate:** relevant tests, type checks, lint, and formatting pass; any unavailable check has a concrete reason and manual evidence.

### Deployment

Use `/pr` to write an evidence-based pull request body. Commit, push, and open a pull request that closes the issue when repository access and the user's requested scope permit external writes.

**Gate:** the pull request links the issue and includes change, verification, and risk evidence, or the exact external-access blocker is reported with a ready-to-use PR body.

### Maintenance

Use `/retro` after delivery to identify improvements to agent navigation, checks, or guidance. Keep only high-confidence improvements caused by this session; defer unrelated cleanup.

**Gate:** material follow-up risks and justified environment improvements are captured.

## Completion report

Report the root cause, implementation, verification evidence, and assumptions or remaining risks. Link the pull request when one was opened.
