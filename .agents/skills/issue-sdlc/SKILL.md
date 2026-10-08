---
name: issue-sdlc
description: Deliver an existing GitHub issue end-to-end. Use when the user asks an agent to take ownership of, implement, or ship an issue autonomously through verification and pull request delivery.
---

# Issue SDLC

Follow [`docs/agents/sdlc.md`](../../../docs/agents/sdlc.md) to its terminal gate.

1. Read each referenced phase skill before entering that phase and apply it directly.
2. Keep an existing issue as the single specification; do not create a duplicate issue. Design rewrites that same issue body via `/to-tickets`.
3. Sequence planning → analysis → design → coding → testing → deployment → maintenance without waiting for a separate user invocation of each phase skill.
4. Review the complete working tree against its merge base, including staged and untracked files, before committing.
5. Resolve material review findings, rerun verification, then open the pull request when external writes are authorized.

Stop only at a lifecycle gate or a definitive external blocker. End with the completion report required by the lifecycle.
