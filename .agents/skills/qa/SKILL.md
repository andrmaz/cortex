---
name: qa
description: >-
  Run a QA walkthrough against an issue's acceptance criteria using Chrome
  DevTools MCP (browser automation and CDP). Use for the SDLC Testing phase,
  or when the user asks for a QA walkthrough, browser verification, or
  acceptance walkthrough before shipping.
disable-model-invocation: true
---

# QA Walkthrough

Prove the issue's acceptance criteria from a user's perspective. Prefer the Chrome DevTools / browser MCP available in this session (navigate, snapshot, screenshot, CDP). Repository unit tests and `/code-review` are not a substitute for this walkthrough.

## 1. Build the walkthrough

From the issue body (and agent brief comments if present), list each acceptance criterion as a numbered step with:

- **Action**: what the user does
- **Expect**: observable result that would fail if the change is wrong
- **Surface**: URL/route, CLI, API, or "non-UI"

Prefer the smallest path that exercises the criterion end-to-end.

## 2. Choose the verification mode

| Change shape | Mode |
| --- | --- |
| User-visible web UI | **Browser**: start or use the local/preview app, walk steps with Chrome DevTools MCP |
| HTTP/API-only | **Request**: hit the running endpoint; use CDP Network when a browser client is involved |
| Docs, skills, agent guidance, or pure library with no runtime surface | **Artifact**: inspect the delivered artifacts against each criterion; state why browser mode does not apply |

Do not skip Browser mode when a UI path exists.

## 3. Browser walkthrough (Chrome DevTools MCP)

1. Confirm the target URL (local dev server, preview, or documented base URL). Start the app only when the repo docs say how and it is required for the criteria.
2. For each step: navigate or interact, then capture evidence with an accessibility snapshot and a screenshot when the visual result matters.
3. Use CDP (`Runtime.evaluate`, DOM queries, Network/console) when the criterion depends on runtime state, errors, or responses not visible in the snapshot.
4. On failure: stop the happy path, record the step, expected vs actual, and evidence. Fix is out of scope for this skill unless the user (or `issue-sdlc`) asks to return to Coding.
5. Unlock/close the browser session when finished with all browser work for the turn.

Avoid click-retry loops without new evidence. After four failed attempts on the same step, mark the criterion failed and continue only if remaining criteria are independent.

## 4. Repository checks

After the walkthrough (or as the sole path in Artifact mode), run the checks described in [`docs/agents/testing.md`](../../../docs/agents/testing.md) and [`docs/agents/commands.md`](../../../docs/agents/commands.md) that apply to the changed workspaces. Record command, exit code, and relevant output.

## 5. Report

Use this template:

```markdown
## QA walkthrough

**Issue:** #<number>
**Mode:** Browser | Request | Artifact
**Result:** pass | fail

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | … | pass/fail | screenshot path, snapshot note, command output, or artifact path |

### Blockers
- None, or list failed criteria with expected vs actual.

### Repo checks
- `<command>` → exit <code>
```

Gate: every in-scope acceptance criterion is `pass`, and required repo checks succeeded (or have an explicit unavailable reason with manual evidence).
