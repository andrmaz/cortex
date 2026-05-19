# API Guidance (`apps/api`)

## Context

- NestJS API with MCP entrypoint.
- Preserve explicit request flow: auth -> policy -> context -> response -> audit.

## Implementation rules

- Keep controllers thin.
- Put business logic in modules/services.
- Avoid direct DB access from controllers.
- Preserve MCP-first behavior when introducing API changes.

## Verification focus

- Validate external contracts (HTTP and MCP responses).
- Validate auth, policy decisions, and scoping behavior in request paths.
