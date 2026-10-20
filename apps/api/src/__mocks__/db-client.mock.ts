import { vi } from "vitest";
/**
 * Jest manual mock for the Prisma generated client (`db/client`) and for the
 * `db` package entrypoint (see `vi.config.js` — both specifiers map here).
 *
 * Used in all unit and integration tests so that module resolution doesn't
 * attempt to load the ESM-only generated Prisma files.
 *
 * `runWithOrgContext`/`runWithoutOrgScope`/`getOrgContext` below are a
 * deliberate, self-contained duplicate of `db`'s `org-scope/context.ts` (not
 * a re-export): because this file's specifier intercepts every `db` import
 * within this test run (including from application code like
 * `OrgContextInterceptor`), it cannot itself `import ... from "db"` without
 * resolving back to itself. The real implementation has no Prisma
 * dependency and is exercised directly by `packages/db`'s own unit tests
 * (`org-scope/context.spec.ts`); keep this copy in sync if that file's
 * behavior changes.
 */
import { AsyncLocalStorage } from "node:async_hooks";

interface OrgContext {
  readonly organizationId: string;
}
interface UnscopedContext {
  readonly unscoped: true;
}
type OrgContextStore = OrgContext | UnscopedContext;

const orgContextStorage = new AsyncLocalStorage<OrgContextStore>();

export async function runWithOrgContext<T>(
  organizationId: string,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  return orgContextStorage.run({ organizationId }, async () => await fn());
}

export async function runWithoutOrgScope<T>(
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  return orgContextStorage.run({ unscoped: true }, async () => await fn());
}

export function getOrgContext(): OrgContextStore | undefined {
  return orgContextStorage.getStore();
}

export function isUnscopedContext(
  context: OrgContextStore,
): context is UnscopedContext {
  return "unscoped" in context && context.unscoped === true;
}

export class MissingOrgContextError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Org-scoped query blocked: no organization context for ${model}.${operation}()`,
    );
    this.name = "MissingOrgContextError";
  }
}

export class OrgScopeViolationError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Org-scoped query blocked: ${model}.${operation}() crossed a tenant boundary`,
    );
    this.name = "OrgScopeViolationError";
  }
}

/**
 * Tests override `PrismaService` entirely (see every `*.integration.spec.ts`
 * and `*.spec.ts`), so the real `createOrgScopedClient` extension never runs
 * in this suite. This stub exists only so application code can import it
 * without a resolution error; it is intentionally never exercised.
 */
export function createOrgScopedClient<T>(baseClient: T): T {
  return baseClient;
}

export const mockPrismaClient = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  department: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  userDepartment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
};

export class PrismaClient {
  $connect = mockPrismaClient.$connect;
  $disconnect = mockPrismaClient.$disconnect;
  $transaction = mockPrismaClient.$transaction;
  user = mockPrismaClient.user;
  organization = mockPrismaClient.organization;
  department = mockPrismaClient.department;
  userDepartment = mockPrismaClient.userDepartment;
}

/** Minimal tagged-template stand-ins for `Prisma.sql` / `Prisma.join`. */
interface MockSql {
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
}

export const Prisma = {
  sql(strings: TemplateStringsArray, ...values: unknown[]): MockSql {
    return { strings: [...strings], values };
  },
  join(values: readonly unknown[], separator = ","): MockSql {
    return {
      strings: ["", ...values.slice(1).map(() => separator), ""],
      values: [...values],
    };
  },
};
