import { getOrgContext, isUnscopedContext } from "./context.js";
import { MissingOrgContextError, OrgScopeViolationError } from "./errors.js";
import {
  computeScopedArgs,
  getScopeConfig,
  RELATION_WRITE_OPERATIONS,
} from "./scope-args.js";
import type { OwnershipCheckClient } from "./verify-relation.js";
import { verifyRelationOwnership } from "./verify-relation.js";

interface AllOperationsParams {
  readonly model?: string;
  readonly operation: string;
  readonly args: unknown;
  readonly query: (args: unknown) => Promise<unknown>;
}

interface RawQueryParams {
  readonly args: unknown;
  readonly query: (args: unknown) => Promise<unknown>;
}

/**
 * Narrow structural type for the subset of the Prisma Client extension API
 * this module relies on. The real `$extends` signature is a deeply generic
 * type tied to a specific client's generated model map; matching it exactly
 * here would couple this package's scoping logic to Prisma's internal
 * typings for no behavioral benefit; the wrapper is verified instead by the
 * pure unit tests in `scope-args.spec.ts` / `where.spec.ts` plus manual
 * end-to-end verification against a live database.
 */
interface ExtensibleClient {
  $extends(extension: {
    name: string;
    query: {
      $allModels: {
        $allOperations(params: AllOperationsParams): Promise<unknown>;
      };
      $queryRaw: (params: RawQueryParams) => Promise<unknown>;
      $executeRaw: (params: RawQueryParams) => Promise<unknown>;
      $queryRawUnsafe: (params: RawQueryParams) => Promise<unknown>;
      $executeRawUnsafe: (params: RawQueryParams) => Promise<unknown>;
    };
  }): unknown;
}

/**
 * Raw SQL cannot carry an org filter, so it is forbidden in a tenant
 * context. The unscoped login/system hatch is the only allowed path.
 */
async function enforceClientOperation(
  operation: string,
  args: unknown,
  query: (args: unknown) => Promise<unknown>,
): Promise<unknown> {
  const context = getOrgContext();
  if (!context) {
    throw new MissingOrgContextError("PrismaClient", operation);
  }
  if (isUnscopedContext(context)) {
    return query(args);
  }
  throw new OrgScopeViolationError("PrismaClient", operation);
}

/**
 * Wraps a Prisma client so every model query is automatically filtered (and,
 * for writes, force-assigned) to the organization bound by
 * `runWithOrgContext`. There is no way to obtain an unscoped model delegate
 * from the returned client, and any query made with no active org context
 * throws `MissingOrgContextError` — org scoping is enforced at the query
 * layer for every call, not opted into per call site.
 *
 * The generic `T` is preserved (via a cast) so the returned value keeps the
 * full delegate surface of the original client (`.user`, `.department`,
 * `$transaction`, ...). Raw SQL (`$queryRaw` / `$executeRaw` / unsafe
 * variants) is rejected unless the caller is inside `runWithoutOrgScope`,
 * because those operations cannot be rewritten with an org filter.
 */
export function createOrgScopedClient<T extends ExtensibleClient>(
  baseClient: T,
): T {
  let scopedClient: T;

  scopedClient = baseClient.$extends({
    name: "org-scope",
    query: {
      $queryRaw: ({ args, query }: RawQueryParams) =>
        enforceClientOperation("$queryRaw", args, query),
      $executeRaw: ({ args, query }: RawQueryParams) =>
        enforceClientOperation("$executeRaw", args, query),
      $queryRawUnsafe: ({ args, query }: RawQueryParams) =>
        enforceClientOperation("$queryRawUnsafe", args, query),
      $executeRawUnsafe: ({ args, query }: RawQueryParams) =>
        enforceClientOperation("$executeRawUnsafe", args, query),
      $allModels: {
        async $allOperations(params: AllOperationsParams): Promise<unknown> {
          const { model, operation, args, query } = params;
          if (!model) {
            return enforceClientOperation(operation, args, query);
          }

          const context = getOrgContext();
          if (!context) {
            throw new MissingOrgContextError(model, operation);
          }
          if (isUnscopedContext(context)) {
            return query(args);
          }

          const { organizationId } = context;
          const scopedArgs = computeScopedArgs(
            {
              model,
              operation,
              args: args as Record<string, unknown> | undefined,
            },
            organizationId,
          );

          const config = getScopeConfig(model);
          if (
            config.kind === "relation" &&
            RELATION_WRITE_OPERATIONS.has(operation)
          ) {
            await verifyRelationOwnership(
              model,
              operation,
              scopedArgs,
              config.verifyVia,
              // The extended client itself is org-scoped, so this lookup is
              // recursively subject to the same enforcement.
              scopedClient as unknown as OwnershipCheckClient,
            );
          }

          return query(scopedArgs);
        },
      },
    },
  }) as T;

  return scopedClient;
}
