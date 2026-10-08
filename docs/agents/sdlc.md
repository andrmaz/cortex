# Software Development Lifecycle

Use this lifecycle when a user asks an agent to take an existing issue through implementation and pull request delivery. The issue is the durable specification; do not create a duplicate issue.

Phases follow the classic [SDLC](https://www.ibm.com/think/topics/sdlc) shape, wired to this repository's agent skills. Where this file or [`issue-tracker.md`](./issue-tracker.md) conflicts with an upstream skill's publish or interaction steps, **this repository's docs win**.

## Entry

1. Fetch the complete issue, comments, and labels using [`issue-tracker.md`](./issue-tracker.md).
2. Read the closest `AGENTS.md`, the relevant domain docs, and the code around the requested behavior.
3. Resolve readiness using [`triage-labels.md`](./triage-labels.md) and the `/triage` skill:

| Issue state | Entry |
| --- | --- |
| Has `ready-for-agent` | Skip Planning, Analysis, and Design. Start at Coding. |
| Has `needs-info`, `ready-for-human`, or `wontfix` | Stop. Report the blocking triage state; do not implement. |
| Unlabeled or `needs-triage` | Apply `/triage` (read the skill and act). Continue only after the issue is `ready-for-agent`. When the user already handed the issue for end-to-end delivery, treat that as maintainer direction to triage toward `ready-for-agent` if the work is implementable; stop if triage concludes otherwise. |
| No issue yet | Run Planning → Analysis → Design to publish one, then continue from Coding once it is `ready-for-agent`. |

4. Ask the user only when a missing product decision would materially change the result.

## Phases and gates

### Planning

Use `/grill-with-docs` to sharpen the plan and capture durable domain language or architecture decisions when they emerge. Skip this phase when Entry already found `ready-for-agent`.

**Gate:** material ambiguities are resolved, and remaining assumptions are explicit.

### Analysis

Use `/to-spec` as the analysis standard. Treat an actionable existing issue as the specification instead of publishing a duplicate; when work starts from a conversation without an issue, use the skill to publish one. Skip this phase when Entry already found `ready-for-agent`.

**Gate:** the problem, acceptance criteria, scope, and verification surface are explicit.

### Design

Use `/to-tickets` to turn the analysis into a detailed, structured ticket plan: tracer-bullet slices, blocking edges, ownership, and test seams, using the project's domain vocabulary and ADRs. Rewrite the **same** GitHub issue body with that structure; do not create child issues or a second tracker. When the work already fits one session, enrich the existing issue in place rather than inventing extra tickets. Skip this phase when Entry already found `ready-for-agent`.

**Gate:** the existing issue body carries a clear, agent-ready ticket structure (what to build, acceptance criteria, and blocking order when multiple slices apply), and the issue is labeled `ready-for-agent`.

### Coding

Use `/implement` to execute the issue or the next ready ticket. Use `/tdd` at the chosen seams where a failing test can demonstrate the missing behavior. Keep unrelated changes out of the diff.

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
