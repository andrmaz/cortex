# Web Guidance (`apps/web`)

## Context

- Next.js Admin Web control plane for Cortex.
- Core journeys: auth, organizations, users/departments, sources, policies, audit logs.

## Implementation rules

- Prefer server-first patterns where appropriate.
- Keep page-level components focused.
- Move truly reusable UI into shared packages.
- Keep admin interactions explicit with clear validation and error states.

## Verification focus

- Verify role/scoping-sensitive UI flows.
- Document manual verification for changed screens when automated coverage is absent.
