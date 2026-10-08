# Issue Tracker

Issues and specifications for this repository live in GitHub Issues at `andrmaz/cortex`. Infer the repository from the `origin` remote and use the `gh` CLI for issue and pull request operations.

Canonical triage state labels are defined in [`triage-labels.md`](./triage-labels.md). Prefer an actionable issue body over waiting for a label when the user already handed the issue to an agent.

## Issue operations

- Read an issue and its discussion with `gh issue view <number> --comments`.
- List work with `gh issue list`, requesting JSON fields when filtering by labels or state.
- Create a specification with `gh issue create`; use a file or heredoc for multiline bodies.
- Rewrite or enrich an existing issue body in place with `gh issue edit <number> --body-file <path>` (or `--body`).
- Update labels with `gh issue edit --add-label` and `--remove-label`.
- Add progress or evidence with `gh issue comment`.
- Close delivered work through a pull request body containing `Closes #<number>`.

When a skill says to publish a specification and no issue exists yet, create a GitHub issue. When it says to fetch a ticket, read the issue body, comments, and labels. When `/to-tickets` (or Design in the SDLC) structures work for an existing issue, rewrite that same issue body with the detailed ticket plan instead of opening child issues.

## Pull requests

Pull requests are the delivery surface, not an input to the triage queue. Use `gh pr view`, `gh pr diff`, `gh pr create`, and `gh pr edit` as needed. Every pull request should identify its source issue and include the evidence required by [`git-workflow.md`](./git-workflow.md).
