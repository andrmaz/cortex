import { describe, it, expect, vi } from "vitest";
import invariant from "invariant";
import { createOrgScopedClient } from "./extension.js";
import { runWithOrgContext, runWithoutOrgScope } from "./context.js";
import { MissingOrgContextError, OrgScopeViolationError } from "./errors.js";

type Impl = (args: unknown) => Promise<unknown>;
type ModelImpls = Record<string, Record<string, Impl>>;

interface AllOperationsParams {
  model?: string;
  operation: string;
  args: unknown;
  query: Impl;
}
interface RawQueryParams {
  args: unknown;
  query: Impl;
}
interface FakeExtension {
  query: {
    $allModels: {
      $allOperations(params: AllOperationsParams): Promise<unknown>;
    };
    $queryRaw?: (params: RawQueryParams) => Promise<unknown>;
    $executeRaw?: (params: RawQueryParams) => Promise<unknown>;
    $queryRawUnsafe?: (params: RawQueryParams) => Promise<unknown>;
    $executeRawUnsafe?: (params: RawQueryParams) => Promise<unknown>;
  };
}

/** Structural shape of the fake client: `$extends` plus arbitrary delegates. */
type FakeClient = {
  $extends(extension: FakeExtension): FakeClient;
  [key: string]: unknown;
};

/** Invokes a model operation on the fake client, asserting it was registered. */
function callModel(
  client: FakeClient,
  model: string,
  operation: string,
  args: unknown,
): Promise<unknown> {
  const delegate = client[model] as Record<string, Impl> | undefined;
  const impl = delegate?.[operation];
  invariant(impl, "Fake client has no %s.%s() registered", model, operation);
  return impl(args);
}

function getNamedRawHandler(
  query: FakeExtension["query"],
  operation: string,
): ((params: RawQueryParams) => Promise<unknown>) | undefined {
  if (
    operation === "$queryRaw" ||
    operation === "$executeRaw" ||
    operation === "$queryRawUnsafe" ||
    operation === "$executeRawUnsafe"
  ) {
    return query[operation];
  }
  return undefined;
}

function callClientOperation(
  client: FakeClient,
  operation: string,
  args: unknown,
): Promise<unknown> {
  const impl = client[operation] as Impl | undefined;
  invariant(impl, "Fake client has no %s() registered", operation);
  return impl(args);
}

/**
 * A minimal fake Prisma client implementing just enough of the real
 * `$extends` contract to exercise `createOrgScopedClient` without a live
 * database: calling a model delegate method routes through the registered
 * `$allOperations` middleware exactly as the real Prisma runtime does,
 * passing the underlying implementation through as `query`. Client-level
 * raw-SQL methods (`$queryRaw`, …) route through the matching named
 * handler when present, otherwise through `$allOperations` with no model.
 */
function createFakeBaseClient(
  modelImpls: ModelImpls,
  clientImpls: Record<string, Impl> = {},
) {
  return {
    $extends(extension: FakeExtension) {
      const scoped: Record<string, unknown> = {};
      for (const [modelDelegate, ops] of Object.entries(modelImpls)) {
        const model =
          modelDelegate.charAt(0).toUpperCase() + modelDelegate.slice(1);
        const nextOps: Record<string, Impl> = {};
        for (const [operation, impl] of Object.entries(ops)) {
          nextOps[operation] = (args: unknown) =>
            extension.query.$allModels.$allOperations({
              model,
              operation,
              args,
              query: impl,
            });
        }
        scoped[modelDelegate] = nextOps;
      }
      for (const [operation, impl] of Object.entries(clientImpls)) {
        const namedHandler = getNamedRawHandler(extension.query, operation);
        scoped[operation] = (args: unknown) => {
          if (namedHandler) {
            return namedHandler({ args, query: impl });
          }
          return extension.query.$allModels.$allOperations({
            operation,
            args,
            query: impl,
          });
        };
      }
      return scoped;
    },
  };
}

describe("createOrgScopedClient", () => {
  it("throws MissingOrgContextError and never calls the underlying query when no context is active", async () => {
    const underlying = vi.fn();
    const client = createOrgScopedClient(
      createFakeBaseClient({
        department: { findMany: underlying },
      }) as unknown as FakeClient,
    );

    await expect(
      callModel(client, "department", "findMany", {}),
    ).rejects.toThrow(MissingOrgContextError);
    expect(underlying).not.toHaveBeenCalled();
  });

  it("injects the org filter into a direct-scoped model's read args", async () => {
    const underlying = vi.fn().mockResolvedValue([{ id: "dept-1" }]);
    const client = createOrgScopedClient(
      createFakeBaseClient({
        department: { findMany: underlying },
      }) as unknown as FakeClient,
    );

    const result = await runWithOrgContext("org-1", () =>
      callModel(client, "department", "findMany", { where: { name: "Eng" } }),
    );

    expect(result).toEqual([{ id: "dept-1" }]);
    expect(underlying).toHaveBeenCalledWith({
      where: { AND: [{ name: "Eng" }, { organizationId: "org-1" }] },
    });
  });

  it("forces organizationId on create, ignoring a caller-supplied value", async () => {
    const underlying = vi.fn().mockResolvedValue({ id: "dept-1" });
    const client = createOrgScopedClient(
      createFakeBaseClient({
        department: { create: underlying },
      }) as unknown as FakeClient,
    );

    await runWithOrgContext("org-1", () =>
      callModel(client, "department", "create", {
        data: { name: "Eng", organizationId: "attacker-org" },
      }),
    );

    expect(underlying).toHaveBeenCalledWith({
      data: { name: "Eng", organizationId: "org-1" },
    });
  });

  it("scopes the self-referential Organization model to the caller's own id", async () => {
    const underlying = vi.fn().mockResolvedValue([{ id: "org-1" }]);
    const client = createOrgScopedClient(
      createFakeBaseClient({
        organization: { findMany: underlying },
      }) as unknown as FakeClient,
    );

    await runWithOrgContext("org-1", () =>
      callModel(client, "organization", "findMany", {}),
    );

    expect(underlying).toHaveBeenCalledWith({ where: { id: "org-1" } });
  });

  it("bypasses scoping entirely inside runWithoutOrgScope", async () => {
    const underlying = vi.fn().mockResolvedValue({ id: "org-2" });
    const client = createOrgScopedClient(
      createFakeBaseClient({
        organization: { findUnique: underlying },
      }) as unknown as FakeClient,
    );

    await runWithoutOrgScope(() =>
      callModel(client, "organization", "findUnique", {
        where: { name: "example.com" },
      }),
    );

    expect(underlying).toHaveBeenCalledWith({ where: { name: "example.com" } });
  });

  it("allows a relation-scoped create when the referenced parent belongs to the caller's org", async () => {
    const findUser = vi
      .fn()
      .mockResolvedValue({ id: "user-1", organizationId: "org-1" });
    const findDepartment = vi
      .fn()
      .mockResolvedValue({ id: "dept-1", organizationId: "org-1" });
    const createUserDepartment = vi.fn().mockResolvedValue({ id: "ud-1" });
    const client = createOrgScopedClient(
      createFakeBaseClient({
        user: { findUnique: findUser },
        department: { findUnique: findDepartment },
        userDepartment: { create: createUserDepartment },
      }) as unknown as FakeClient,
    );

    await runWithOrgContext("org-1", () =>
      callModel(client, "userDepartment", "create", {
        data: { userId: "user-1", departmentId: "dept-1" },
      }),
    );

    // The verification lookup runs through the same org-scoped client, so
    // it is itself scoped to the caller's organization (flat merge, since
    // findUnique requires the unique `id` field to stay top-level).
    expect(findUser).toHaveBeenCalledWith({
      where: { id: "user-1", organizationId: "org-1" },
    });
    expect(findDepartment).toHaveBeenCalledWith({
      where: { id: "dept-1", organizationId: "org-1" },
    });
    expect(createUserDepartment).toHaveBeenCalledWith({
      data: { userId: "user-1", departmentId: "dept-1" },
    });
  });

  it("rejects a relation-scoped create when the referenced parent belongs to another org", async () => {
    // The recursive `user.findUnique` lookup is itself org-scoped, so a
    // foreign-org user id resolves to nothing under the caller's context.
    const findUnique = vi.fn().mockResolvedValue(null);
    const createUserDepartment = vi.fn();
    const client = createOrgScopedClient(
      createFakeBaseClient({
        user: { findUnique },
        department: {
          findUnique: vi.fn().mockResolvedValue({ id: "dept-1" }),
        },
        userDepartment: { create: createUserDepartment },
      }) as unknown as FakeClient,
    );

    await expect(
      runWithOrgContext("org-1", () =>
        callModel(client, "userDepartment", "create", {
          data: { userId: "cross-org-user", departmentId: "dept-1" },
        }),
      ),
    ).rejects.toThrow(OrgScopeViolationError);

    expect(createUserDepartment).not.toHaveBeenCalled();
  });

  it("rejects an in-scope user paired with another organization's department", async () => {
    const findUser = vi.fn().mockResolvedValue({ id: "user-1" });
    const findDepartment = vi.fn().mockResolvedValue(null);
    const createUserDepartment = vi.fn();
    const client = createOrgScopedClient(
      createFakeBaseClient({
        user: { findUnique: findUser },
        department: { findUnique: findDepartment },
        userDepartment: { create: createUserDepartment },
      }) as unknown as FakeClient,
    );

    await expect(
      runWithOrgContext("org-1", () =>
        callModel(client, "userDepartment", "create", {
          data: { userId: "user-1", departmentId: "cross-org-dept" },
        }),
      ),
    ).rejects.toThrow(OrgScopeViolationError);

    expect(findUser).toHaveBeenCalledWith({
      where: { id: "user-1", organizationId: "org-1" },
    });
    expect(findDepartment).toHaveBeenCalledWith({
      where: { id: "cross-org-dept", organizationId: "org-1" },
    });
    expect(createUserDepartment).not.toHaveBeenCalled();
  });

  it("forces organizationId on Document create under direct scope", async () => {
    const createDocument = vi.fn().mockResolvedValue({ id: "document-1" });
    const client = createOrgScopedClient(
      createFakeBaseClient({
        document: { create: createDocument },
      }) as unknown as FakeClient,
    );

    await runWithOrgContext("org-1", () =>
      callModel(client, "document", "create", {
        data: {
          sourceId: "source-1",
          content: "hello",
          organizationId: "attacker-org",
        },
      }),
    );

    expect(createDocument).toHaveBeenCalledWith({
      data: {
        sourceId: "source-1",
        content: "hello",
        organizationId: "org-1",
      },
    });
  });

  it("forces organizationId on Chunk create under direct scope", async () => {
    const createChunk = vi.fn().mockResolvedValue({ id: "chunk-1" });
    const client = createOrgScopedClient(
      createFakeBaseClient({
        chunk: { create: createChunk },
      }) as unknown as FakeClient,
    );

    await runWithOrgContext("org-1", () =>
      callModel(client, "chunk", "create", {
        data: {
          documentId: "document-1",
          content: "hello",
          organizationId: "attacker-org",
        },
      }),
    );

    expect(createChunk).toHaveBeenCalledWith({
      data: {
        documentId: "document-1",
        content: "hello",
        organizationId: "org-1",
      },
    });
  });

  it("keeps concurrent requests for different organizations isolated", async () => {
    const underlying = vi.fn(async (args: unknown) => args);
    const client = createOrgScopedClient(
      createFakeBaseClient({
        department: { findMany: underlying },
      }) as unknown as FakeClient,
    );

    const [resultA, resultB] = await Promise.all([
      runWithOrgContext("org-a", () =>
        callModel(client, "department", "findMany", {}),
      ),
      runWithOrgContext("org-b", () =>
        callModel(client, "department", "findMany", {}),
      ),
    ]);

    expect(resultA).toEqual({ where: { organizationId: "org-a" } });
    expect(resultB).toEqual({ where: { organizationId: "org-b" } });
  });

  it("rejects $queryRaw when a tenant context is active", async () => {
    const underlying = vi.fn();
    const client = createOrgScopedClient(
      createFakeBaseClient(
        {},
        { $queryRaw: underlying },
      ) as unknown as FakeClient,
    );

    await expect(
      runWithOrgContext("org-1", () =>
        callClientOperation(client, "$queryRaw", "SELECT 1"),
      ),
    ).rejects.toThrow(OrgScopeViolationError);
    expect(underlying).not.toHaveBeenCalled();
  });

  it("rejects $queryRaw when no org context is active", async () => {
    const underlying = vi.fn();
    const client = createOrgScopedClient(
      createFakeBaseClient(
        {},
        { $queryRaw: underlying },
      ) as unknown as FakeClient,
    );

    await expect(
      callClientOperation(client, "$queryRaw", "SELECT 1"),
    ).rejects.toThrow(MissingOrgContextError);
    expect(underlying).not.toHaveBeenCalled();
  });

  it("allows $queryRaw inside runWithoutOrgScope", async () => {
    const underlying = vi.fn().mockResolvedValue([{ ok: 1 }]);
    const client = createOrgScopedClient(
      createFakeBaseClient(
        {},
        { $queryRaw: underlying },
      ) as unknown as FakeClient,
    );

    const result = await runWithoutOrgScope(() =>
      callClientOperation(client, "$queryRaw", "SELECT 1"),
    );

    expect(result).toEqual([{ ok: 1 }]);
    expect(underlying).toHaveBeenCalledWith("SELECT 1");
  });
});
