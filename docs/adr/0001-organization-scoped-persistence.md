# Make organization scoping the default at the persistence boundary

All API database access goes through an organization-scoped Prisma client by default, with cross-organization operations requiring an explicit system context. This favors fail-closed, centralized tenant isolation over relying on every service to remember organization filters, at the cost of a small, deliberate escape hatch for system operations.
