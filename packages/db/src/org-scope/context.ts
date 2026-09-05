import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Active tenant scope for the current request/operation.
 */
export interface OrgContext {
  readonly organizationId: string;
}

/**
 * Explicit marker for code paths that legitimately need to query across
 * organizations (see {@link runWithoutOrgScope}).
 */
export interface UnscopedContext {
  readonly unscoped: true;
}

export type OrgContextStore = OrgContext | UnscopedContext;

const storage = new AsyncLocalStorage<OrgContextStore>();

/**
 * Runs `fn` with `organizationId` bound as the active tenant scope for every
 * org-scoped Prisma query made during its execution (including inside
 * awaited async continuations). This is the only supported way to make
 * org-scoped queries succeed — there is no ambient "current organization"
 * outside of this call.
 *
 * The callback may return a Promise or a lazy Prisma thenable directly;
 * `runWithOrgContext` consumes it before leaving the active context:
 *
 * ```ts
 * const users = await runWithOrgContext(orgId, () => db.user.findMany());
 * ```
 */
export async function runWithOrgContext<T>(
  organizationId: string,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  return storage.run({ organizationId }, async () => await fn());
}

/**
 * Escape hatch for pre-authentication / system code paths that legitimately
 * need to query across organizations (e.g. resolving which Organization owns
 * an email domain during login, before the caller's org is known).
 *
 * Every call site is a deliberate, auditable exception to org isolation —
 * grep for `runWithoutOrgScope` in review and justify each usage in a
 * neighboring comment. See `runWithOrgContext`'s doc comment for why `fn`
 * must be `async`.
 */
export function runWithoutOrgScope<T>(fn: () => T): T {
  return storage.run({ unscoped: true }, fn);
}

/** Returns the active org context, or `undefined` if none has been set. */
export function getOrgContext(): OrgContextStore | undefined {
  return storage.getStore();
}

export function isUnscopedContext(
  context: OrgContextStore,
): context is UnscopedContext {
  return "unscoped" in context && context.unscoped === true;
}
