# Deletion Candidates (from previous AGENTS files)

These items are candidates for deletion because they are redundant, vague, or obvious.

## Redundant with progressive-disclosure structure

- Repeating the same security/testing guidance in root and every nested `AGENTS.md`.
- Repeating command lists in multiple files when one shared `commands.md` can be referenced.

## Too vague to be actionable

- "Keep architecture modular" (without module boundary examples or concrete checks).
- "Prefer local reproducibility over speculative ops automation" (good intent, weak actionability).

## Overly obvious / already known defaults

- "Use TypeScript" (for this repo it is useful once; repeating it in every file adds noise).
- "Keep commits small" when stated in multiple places with no additional constraints.
- "Treat deployment as out of scope unless requested" in general AGENTS guidance (task-specific, not durable project rule).
