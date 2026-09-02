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
 * **Correct usage — `fn` must be `async` (or otherwise consume any returned
 * Prisma call synchronously within its own body):**
 *
 * ```ts
 * // Correct: the callback is async, so `db.user.findMany(...)` is attached
 * // to (via the implicit return-value resolution) while still inside the
 * // active context.
 * const users = await runWithOrgContext(orgId, async () => db.user.findMany());
 * ```
 *
 * **Incorrect — do not do this:**
 *
 * ```ts
 * // Wrong: Prisma's client methods return a *lazy* promise that doesn't
 * // register a `.then()` reaction until something awaits it. A plain
 * // (non-async) callback just hands that lazy promise back to
 * // `runWithOrgContext`, which itself returns synchronously and restores
 * // the *previous* context before the caller ever gets a chance to await
 * // it — so the eventual query runs with no org context bound at all.
 * const users = await runWithOrgContext(orgId, () => db.user.findMany());
 * ```
 */
export function runWithOrgContext<T>(organizationId: string, fn: () => T): T {
  return storage.run({ organizationId }, fn);
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
