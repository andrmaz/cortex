# Code Style

## Language and architecture

- Use TypeScript for all new code.
- Keep module boundaries clear; avoid cross-layer leakage.
- Keep controllers/pages thin; place business logic in services or domain modules.

## Contracts and typing

- Use explicit types at public boundaries (DTOs, service contracts, shared types).
- Validate external input at boundaries (HTTP/MCP handlers, form/request payloads).

## Naming and terminology

- Follow domain terms from `UBIQUITOUS_LANGUAGE.md`.
- Prefer consistent product terms (`Organization`, `Policy`, `Context Bundle`, `Policy Decision`) in user-facing docs/spec text.

## Tooling consistency

- Use existing lint/format/type tooling for the workspace.
- Do not introduce parallel lint/format stacks without explicit approval.
