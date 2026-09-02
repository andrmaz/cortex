/** Narrows an unknown value to a plain filter/data object Prisma would accept. */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Builds a nested relation `where` filter from a chain of relation field
 * names ending in a scalar field, e.g. `["document", "source",
 * "organizationId"]` -> `{ document: { source: { organizationId: id } } }`.
 */
export function buildRelationFilter(
  chain: readonly [string, ...string[]],
  organizationId: string,
): Record<string, unknown> {
  const [head, ...rest] = chain;
  if (rest.length === 0) {
    return { [head]: organizationId };
  }
  return {
    [head]: buildRelationFilter(rest as [string, ...string[]], organizationId),
  };
}

/**
 * Merges an org-scoping filter into an existing (possibly absent) `where`
 * clause for operations that accept Prisma's general `WhereInput` type
 * (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`,
 * `deleteMany`). Uses `AND` rather than a shallow spread so the caller's
 * filter can't accidentally be overwritten by a colliding key, and so the
 * merge is safe regardless of what the caller's `where` contains.
 */
export function mergeWhere(
  where: unknown,
  scopeFilter: Record<string, unknown>,
): Record<string, unknown> {
  if (!isPlainObject(where) || Object.keys(where).length === 0) {
    return scopeFilter;
  }
  return { AND: [where, scopeFilter] };
}

/**
 * Merges an org-scoping filter into a `where` clause for operations that
 * accept Prisma's `WhereUniqueInput` type (`findUnique`,
 * `findUniqueOrThrow`, `update`, `delete`, `upsert`). Prisma requires the
 * unique identifier to remain a direct top-level field on `where` — wrapping
 * it in `AND` fails validation ("needs at least one of `id` ... arguments").
 * Extra non-unique fields (including relation filters) are supported
 * alongside it at the top level instead, so this does a shallow merge with
 * the scope filter spread last, guaranteeing it always wins on a colliding
 * key (e.g. a caller-supplied `organizationId`, or — for the
 * self-referential `Organization` model, where the scope filter's key IS
 * the unique identifier — the requested `id` itself).
 */
export function mergeUniqueWhere(
  where: unknown,
  scopeFilter: Record<string, unknown>,
): Record<string, unknown> {
  if (!isPlainObject(where)) {
    return { ...scopeFilter };
  }
  return { ...where, ...scopeFilter };
}

/** Returns a shallow copy of `data` with `field` removed, if present. */
export function stripField(
  data: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  if (!(field in data)) {
    return data;
  }
  const next = { ...data };
  delete next[field];
  return next;
}
