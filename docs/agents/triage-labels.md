# Triage Labels

These are the canonical GitHub label names for issue triage state. They match the `/triage` skill roles one-to-one.

- `needs-triage`: a maintainer needs to evaluate the issue.
- `needs-info`: the issue is waiting for information from its reporter.
- `ready-for-agent`: the issue is fully specified for autonomous implementation.
- `ready-for-human`: the issue requires human implementation or judgment.
- `wontfix`: the issue will not be actioned.

Every triaged issue should have exactly one state label. Use the existing `bug` or `enhancement` label for its category.

The SDLC entry gate treats `ready-for-agent` as the signal to skip Planning, Analysis, and Design. Detect it from the issue's labels via [`issue-tracker.md`](./issue-tracker.md); produce or change it by applying `/triage`.
