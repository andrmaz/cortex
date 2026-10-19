---
name: issue-sdlc
description: Deliver an existing GitHub issue end-to-end. Use when the user asks an agent to take ownership of, implement, or ship an issue autonomously through verification and pull request delivery.
---

# Issue SDLC

Follow [`docs/agents/sdlc.md`](../../../docs/agents/sdlc.md) to its terminal gate.

0. Act as the low-effort orchestrator: run every phase in its own dedicated sub-agent (medium effort; Planning only may use high). Create the ledger `.tools/sdlc-ledger/issue-<number>.md` (pass sub-agents its resolved absolute path) and run Entry in a sub-agent, and tell each sub-agent its phase, the ledger path, and to read the ledger first and append its result before returning. See "Orchestration" in the lifecycle doc.
1. Read each referenced phase skill before entering that phase and apply it directly (inside that phase's sub-agent). Repository docs override upstream skill publish and interaction steps.
2. Keep an existing issue as the single specification; do not create a duplicate issue. Design rewrites that same issue body via `/to-tickets`.
3. At Entry, detect `ready-for-agent` from issue labels. If present, skip Planning, Analysis, and Design and start at Coding. Otherwise apply `/triage` before Coding; stop on `needs-info`, `ready-for-human`, or `wontfix`.
4. Sequence the remaining phases through maintenance without waiting for a separate user invocation of each phase skill. Coding includes `/tdd` and `/code-review`; Testing is `/qa` (Chrome DevTools MCP walkthrough).
5. Resolve material Coding review findings, complete the `/qa` walkthrough gate, then open the pull request when external writes are authorized.

Stop only at a lifecycle gate or a definitive external blocker. End with the completion report required by the lifecycle.
