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
interface FakeExtension {
  query: {
    $allModels: {
      $allOperations(params: AllOperationsParams): Promise<unknown>;
    };
  };
}

/** Structural shape of the fake client: `$extends` plus arbitrary model delegates. */
type FakeClient = {
  $extends(extension: FakeExtension): Record<string, Record<string, Impl>>;
} & Record<string, Record<string, Impl>>;

/** Invokes a model operation on the fake client, asserting it was registered. */
function callModel(
  client: FakeClient,
  model: string,
  operation: string,
  args: unknown,
): Promise<unknown> {
  const delegate = client[model];
  const impl = delegate?.[operation];
  if (!impl) {
    throw new Error(`Fake client has no ${model}.${operation}() registered`);
  }
  return impl(args);
}

/**
 * A minimal fake Prisma client implementing just enough of the real
 * `$extends` contract to exercise `createOrgScopedClient` without a live
 * database: calling a model delegate method routes through the registered
 * `$allOperations` middleware exactly as the real Prisma runtime does,
 * passing the underlying implementation through as `query`.
 */
function createFakeBaseClient(modelImpls: ModelImpls) {
  return {
    $extends(extension: FakeExtension) {
      const scoped: Record<string, Record<string, Impl>> = {};
      for (const [modelDelegate, ops] of Object.entries(modelImpls)) {
        const model =
          modelDelegate.charAt(0).toUpperCase() + modelDelegate.slice(1);
        scoped[modelDelegate] = {};
        for (const [operation, impl] of Object.entries(ops)) {
          scoped[modelDelegate][operation] = (args: unknown) =>
            extension.query.$allModels.$allOperations({
              model,
              operation,
              args,
              query: impl,
            });
        }
      }
      return scoped;
    },
  };
}

describe("createOrgScopedClient", () => {
  it("throws MissingOrgContextError and never calls the underlying query when no context is active", async () => {
    const underlying = jest.fn();
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
    const underlying = jest.fn().mockResolvedValue([{ id: "dept-1" }]);
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
    const underlying = jest.fn().mockResolvedValue({ id: "dept-1" });
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
    const underlying = jest.fn().mockResolvedValue([{ id: "org-1" }]);
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
    const underlying = jest.fn().mockResolvedValue({ id: "org-2" });
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
    const findUser = jest
      .fn()
      .mockResolvedValue({ id: "user-1", organizationId: "org-1" });
    const findDepartment = jest
      .fn()
      .mockResolvedValue({ id: "dept-1", organizationId: "org-1" });
    const createUserDepartment = jest.fn().mockResolvedValue({ id: "ud-1" });
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
    const findUnique = jest.fn().mockResolvedValue(null);
    const createUserDepartment = jest.fn();
    const client = createOrgScopedClient(
      createFakeBaseClient({
        user: { findUnique },
        department: {
          findUnique: jest.fn().mockResolvedValue({ id: "dept-1" }),
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
    const findUser = jest.fn().mockResolvedValue({ id: "user-1" });
    const findDepartment = jest.fn().mockResolvedValue(null);
    const createUserDepartment = jest.fn();
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

  it.each([
    ["create", { data: { source: { connect: { id: "cross-org-source" } } } }],
    [
      "update",
      {
        where: { id: "document-1" },
        data: { source: { connect: { id: "cross-org-source" } } },
      },
    ],
    [
      "upsert create branch",
      {
        where: { id: "document-1" },
        create: { source: { connect: { id: "cross-org-source" } } },
        update: { sourceId: "source-1" },
      },
    ],
    [
      "upsert update branch",
      {
        where: { id: "document-1" },
        create: { sourceId: "source-1" },
        update: { source: { connect: { id: "cross-org-source" } } },
      },
    ],
  ])(
    "rejects cross-organization nested connect during %s",
    async (label, args) => {
      const operation = label.startsWith("upsert") ? "upsert" : label;
      const findSource = jest.fn(async (input: unknown) => {
        const { where } = input as { where: { id?: string } };
        return where.id === "source-1" ? { id: "source-1" } : null;
      });
      const writeDocument = jest.fn();
      const client = createOrgScopedClient(
        createFakeBaseClient({
          source: { findUnique: findSource },
          document: { [operation]: writeDocument },
        }) as unknown as FakeClient,
      );

      await expect(
        runWithOrgContext("org-1", () =>
          callModel(client, "document", operation, args),
        ),
      ).rejects.toThrow(OrgScopeViolationError);
      expect(findSource).toHaveBeenCalledWith({
        where: { id: "cross-org-source", organizationId: "org-1" },
      });
      expect(writeDocument).not.toHaveBeenCalled();
    },
  );

  it("allows an in-scope nested connect during create", async () => {
    const findSource = jest.fn().mockResolvedValue({ id: "source-1" });
    const createDocument = jest.fn().mockResolvedValue({ id: "document-1" });
    const client = createOrgScopedClient(
      createFakeBaseClient({
        source: { findUnique: findSource },
        document: { create: createDocument },
      }) as unknown as FakeClient,
    );

    await runWithOrgContext("org-1", () =>
      callModel(client, "document", "create", {
        data: { source: { connect: { id: "source-1" } } },
      }),
    );

    expect(findSource).toHaveBeenCalledWith({
      where: { id: "source-1", organizationId: "org-1" },
    });
    expect(createDocument).toHaveBeenCalledWith({
      data: { source: { connect: { id: "source-1" } } },
    });
  });

  it("keeps concurrent requests for different organizations isolated", async () => {
    const underlying = jest.fn(async (args: unknown) => args);
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
});
