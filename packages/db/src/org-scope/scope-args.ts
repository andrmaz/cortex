import type { OrgScopeConfig } from "./config.js";
import { ORG_SCOPE_CONFIG } from "./config.js";
import { OrgScopeViolationError, UnknownOrgScopeModelError } from "./errors.js";
import {
  buildRelationFilter,
  isPlainObject,
  mergeUniqueWhere,
  mergeWhere,
  stripField,
} from "./where.js";

/** Accept Prisma's general `WhereInput` type — arbitrary AND/OR/NOT nesting is valid. */
const GENERAL_WHERE_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);
/**
 * Accept Prisma's `WhereUniqueInput` type — the unique identifier must stay
 * a direct top-level field; wrapping it in `AND` fails Prisma's validation.
 */
const UNIQUE_WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
]);
export const CREATE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);

export const RELATION_WRITE_OPERATIONS = new Set([
  ...CREATE_OPERATIONS,
  "update",
  "updateMany",
  "upsert",
]);

const ALL_WHERE_FILTERED_OPERATIONS = new Set([
  ...GENERAL_WHERE_OPERATIONS,
  ...UNIQUE_WHERE_OPERATIONS,
  "upsert",
]);

export interface ScopeArgsInput {
  readonly model: string;
  readonly operation: string;
  readonly args: Record<string, unknown> | undefined;
}

/**
 * Looks up a model's org-scoping strategy, failing closed (rather than
 * silently passing the query through unscoped) when the model is
 * unregistered.
 */
export function getScopeConfig(model: string): OrgScopeConfig {
  const config = ORG_SCOPE_CONFIG[model];
  if (!config) {
    throw new UnknownOrgScopeModelError(model);
  }
  return config;
}

/** Merges a scope filter into `where` using the strategy the operation requires. */
function mergeScopeIntoWhere(
  operation: string,
  where: unknown,
  scopeFilter: Record<string, unknown>,
): Record<string, unknown> {
  return UNIQUE_WHERE_OPERATIONS.has(operation) || operation === "upsert"
    ? mergeUniqueWhere(where, scopeFilter)
    : mergeWhere(where, scopeFilter);
}

/**
 * Pure transformation of Prisma query args to enforce org scoping. Contains
 * no I/O and no Prisma runtime dependency, so it can be unit tested directly
 * against plain objects.
 *
 * Relation-scoped `create`/`createMany` are intentionally left untouched
 * here — verifying a foreign key belongs to the caller's org requires a
 * database round trip, which `extension.ts` performs separately (see
 * `verifyRelationOwnership`).
 */
export function computeScopedArgs(
  { model, operation, args }: ScopeArgsInput,
  organizationId: string,
): Record<string, unknown> {
  const config = getScopeConfig(model);
  const nextArgs: Record<string, unknown> = { ...(args ?? {}) };

  switch (config.kind) {
    case "self":
      return applySelfScope(nextArgs, operation, organizationId, model);
    case "direct":
      return applyDirectScope(
        nextArgs,
        operation,
        organizationId,
        config.field,
        model,
      );
    case "relation":
      return applyRelationScope(nextArgs, operation, organizationId, model);
    default: {
      const exhaustiveCheck: never = config;
      return exhaustiveCheck;
    }
  }
}

function applySelfScope(
  args: Record<string, unknown>,
  operation: string,
  organizationId: string,
  model: string,
): Record<string, unknown> {
  if (CREATE_OPERATIONS.has(operation)) {
    // Creating a brand-new Organization is not scoped to an existing one.
    return args;
  }
  if (ALL_WHERE_FILTERED_OPERATIONS.has(operation)) {
    args["where"] = mergeScopeIntoWhere(operation, args["where"], {
      id: organizationId,
    });
    return args;
  }
  throw unsupportedOperation(model, operation);
}

function applyDirectScope(
  args: Record<string, unknown>,
  operation: string,
  organizationId: string,
  field: string,
  model: string,
): Record<string, unknown> {
  if (operation === "create") {
    const data = isPlainObject(args["data"]) ? args["data"] : {};
    rejectNestedForeignKeyWrite(data, field, model, operation);
    args["data"] = { ...data, [field]: organizationId };
    return args;
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const items = Array.isArray(args["data"]) ? args["data"] : [args["data"]];
    args["data"] = items.map((item: unknown) => {
      const data = isPlainObject(item) ? item : {};
      rejectNestedForeignKeyWrite(data, field, model, operation);
      return { ...data, [field]: organizationId };
    });
    return args;
  }
  if (operation === "upsert") {
    args["where"] = mergeScopeIntoWhere(operation, args["where"], {
      [field]: organizationId,
    });
    const create = isPlainObject(args["create"]) ? args["create"] : {};
    rejectNestedForeignKeyWrite(create, field, model, operation);
    args["create"] = { ...create, [field]: organizationId };
    if (isPlainObject(args["update"])) {
      rejectNestedForeignKeyWrite(args["update"], field, model, operation);
      args["update"] = stripField(args["update"], field);
    }
    return args;
  }
  if (ALL_WHERE_FILTERED_OPERATIONS.has(operation)) {
    args["where"] = mergeScopeIntoWhere(operation, args["where"], {
      [field]: organizationId,
    });
    // Never allow a scoped update to reassign a record to another org.
    if (isPlainObject(args["data"])) {
      rejectNestedForeignKeyWrite(args["data"], field, model, operation);
      args["data"] = stripField(args["data"], field);
    }
    return args;
  }
  throw unsupportedOperation(model, operation);
}

function rejectNestedForeignKeyWrite(
  data: Record<string, unknown>,
  foreignKeyField: string,
  model: string,
  operation: string,
): void {
  const relationField = foreignKeyField.endsWith("Id")
    ? foreignKeyField.slice(0, -2)
    : undefined;
  if (relationField && relationField in data) {
    throw new OrgScopeViolationError(model, operation);
  }
}

function applyRelationScope(
  args: Record<string, unknown>,
  operation: string,
  organizationId: string,
  model: string,
): Record<string, unknown> {
  const config = getScopeConfig(model);
  if (config.kind !== "relation") {
    throw unsupportedOperation(model, operation);
  }
  if (CREATE_OPERATIONS.has(operation)) {
    // Verified separately in extension.ts via a database round trip.
    return args;
  }
  if (ALL_WHERE_FILTERED_OPERATIONS.has(operation)) {
    const filter = buildRelationFilter(config.chain, organizationId);
    args["where"] = mergeScopeIntoWhere(operation, args["where"], filter);
    return args;
  }
  throw unsupportedOperation(model, operation);
}

function unsupportedOperation(model: string, operation: string): Error {
  return new Error(
    `Org-scoped query blocked: "${model}.${operation}()" is not a ` +
      "recognized read/write operation. Add explicit handling in " +
      "scope-args.ts before using it on an org-scoped model.",
  );
}
