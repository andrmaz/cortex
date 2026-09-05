import type { RelationVerification } from "./config.js";
import { OrgScopeViolationError } from "./errors.js";
import { isPlainObject } from "./where.js";
import { RELATION_WRITE_OPERATIONS } from "./scope-args.js";

/** Minimal shape of an org-scoped Prisma client needed to verify a foreign key. */
export interface OwnershipCheckClient {
  [modelDelegate: string]: {
    findUnique(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

function toModelDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Verifies that every parent referenced by a relation-scoped write belongs
 * to the caller's organization. Scalar foreign keys and nested `connect`
 * payloads are looked up through the same org-scoped client. Other nested
 * parent mutations are rejected because Prisma does not run query extensions
 * separately for nested writes.
 */
export async function verifyRelationOwnership(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  verifications: readonly RelationVerification[],
  client: OwnershipCheckClient,
): Promise<void> {
  if (!RELATION_WRITE_OPERATIONS.has(operation)) {
    return;
  }

  const items = getWriteItems(operation, args).filter(isPlainObject);
  const checks: Array<{
    parentModel: string;
    where: Record<string, unknown>;
  }> = [];

  for (const verification of verifications) {
    const relationField = toModelDelegateName(verification.parentModel);
    for (const item of items) {
      const foreignKey = getForeignKey(item[verification.foreignKeyField]);
      if (foreignKey !== undefined) {
        checks.push({
          parentModel: verification.parentModel,
          where: { id: foreignKey },
        });
      }

      if (!(relationField in item)) {
        continue;
      }
      const relationWrite = item[relationField];
      if (
        !isPlainObject(relationWrite) ||
        Object.keys(relationWrite).some((key) => key !== "connect") ||
        !("connect" in relationWrite)
      ) {
        throw new OrgScopeViolationError(model, operation);
      }

      const connects = Array.isArray(relationWrite["connect"])
        ? relationWrite["connect"]
        : [relationWrite["connect"]];
      for (const where of connects) {
        if (!isPlainObject(where)) {
          throw new OrgScopeViolationError(model, operation);
        }
        checks.push({ parentModel: verification.parentModel, where });
      }
    }
  }

  const seen = new Set<string>();
  const uniqueChecks = checks.filter(({ parentModel, where }) => {
    const key = `${parentModel}:${JSON.stringify(where)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  await Promise.all(
    uniqueChecks.map(async ({ parentModel, where }) => {
      const parentDelegate = client[toModelDelegateName(parentModel)];
      const parent = await parentDelegate?.findUnique({ where });
      if (!parent) {
        throw new OrgScopeViolationError(model, operation);
      }
    }),
  );
}

function getForeignKey(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (isPlainObject(value) && typeof value["set"] === "string") {
    return value["set"];
  }
  return undefined;
}

function getWriteItems(
  operation: string,
  args: Record<string, unknown>,
): unknown[] {
  if (operation === "upsert") {
    return [args["create"], args["update"]];
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    return Array.isArray(args["data"]) ? args["data"] : [args["data"]];
  }
  return [args["data"]];
}
