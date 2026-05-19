# Testing

## Testing principles

- Test observable behavior and contracts, not implementation details.
- Prefer narrow, reproducible verification tied to changed behavior.
- Do not claim tests passed unless you ran them.

## Execution rules

- Run the most relevant lint and type-check commands for affected workspaces.
- If no reliable automated tests exist for changed code, include manual verification steps.

## Current repo reality

- API test script is currently a placeholder and intentionally fails.
- DB package test script is currently a placeholder and intentionally fails.
- For API/DB changes today, manual verification notes are required until real tests are added.
