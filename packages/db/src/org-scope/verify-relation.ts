import type { RelationVerification } from "./config.js";
import { OrgScopeViolationError } from "./errors.js";
import { isPlainObject } from "./where.js";
import { CREATE_OPERATIONS } from "./scope-args.js";

/** Minimal shape of an org-scoped Prisma client needed to verify a foreign key. */
export interface OwnershipCheckClient {
  [modelDelegate: string]: {
    findUnique(args: { where: { id: string } }): Promise<unknown>;
  };
}

function toModelDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Verifies that the foreign key referenced by a relation-scoped `create`/
 * `createMany` payload belongs to the caller's organization, by looking up
 * the parent record through the *same* org-scoped client. Because that
 * lookup is itself subject to org scoping, a foreign key from another
 * organization simply won't be found — turning a cross-tenant write attempt
 * into a clear, auditable rejection instead of silently succeeding.
 */
export async function verifyRelationOwnership(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  verifyVia: RelationVerification,
  client: OwnershipCheckClient,
): Promise<void> {
  if (!CREATE_OPERATIONS.has(operation)) {
    return;
  }

  const items =
    operation === "create"
      ? [args["data"]]
      : Array.isArray(args["data"])
        ? args["data"]
        : [];

  const foreignKeys = items
    .filter(isPlainObject)
    .map((item) => item[verifyVia.foreignKeyField])
    .filter((value): value is string => typeof value === "string");

  const uniqueForeignKeys = Array.from(new Set(foreignKeys));
  const parentDelegate = client[toModelDelegateName(verifyVia.parentModel)];

  await Promise.all(
    uniqueForeignKeys.map(async (id) => {
      const parent = await parentDelegate?.findUnique({ where: { id } });
      if (!parent) {
        throw new OrgScopeViolationError(model, operation);
      }
    }),
  );
}
