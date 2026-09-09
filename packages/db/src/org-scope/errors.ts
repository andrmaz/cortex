/**
 * Thrown when an org-scoped Prisma query is attempted with no active org
 * context (see `runWithOrgContext` / `runWithoutOrgScope`). This indicates a
 * programming error — a code path that reaches the database without going
 * through the request-scoping middleware — and is intentionally distinct
 * from {@link OrgScopeViolationError}, which represents a legitimate,
 * authenticated attempt to cross a tenant boundary.
 */
export class MissingOrgContextError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Org-scoped query blocked: no organization context is active for ` +
        `${model}.${operation}(). Wrap this call in runWithOrgContext(...) ` +
        "or, for justified system paths, runWithoutOrgScope(...).",
    );
    this.name = "MissingOrgContextError";
  }
}

/**
 * Thrown when an authenticated caller's org context does not match the
 * organization that owns the record(s) being accessed or referenced. API
 * layers should map this to 403 Forbidden (or 404 Not Found, where existence
 * itself should not be disclosed).
 */
export class OrgScopeViolationError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Org-scoped query blocked: ${model}.${operation}() referenced a ` +
        "record outside the caller's organization.",
    );
    this.name = "OrgScopeViolationError";
  }
}

/**
 * Thrown when a model has no registered org-scoping strategy. New models
 * must be added to `ORG_SCOPE_CONFIG` before they can be queried through the
 * org-scoped client — this keeps scoping mandatory rather than opt-in as the
 * schema grows.
 */
export class UnknownOrgScopeModelError extends Error {
  constructor(model: string) {
    super(
      `Org-scoped query blocked: model "${model}" has no registered org ` +
        "scoping strategy in ORG_SCOPE_CONFIG.",
    );
    this.name = "UnknownOrgScopeModelError";
  }
}
