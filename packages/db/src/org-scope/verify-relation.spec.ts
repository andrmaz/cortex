import { verifyRelationOwnership } from "./verify-relation.js";
import { OrgScopeViolationError } from "./errors.js";
import type { RelationVerification } from "./config.js";

const verifyVia: readonly RelationVerification[] = [
  { foreignKeyField: "userId", parentModel: "User" },
  { foreignKeyField: "departmentId", parentModel: "Department" },
];

const sourceVerifyVia: readonly RelationVerification[] = [
  { foreignKeyField: "sourceId", parentModel: "Source" },
];

function makeClient(
  existing: Partial<
    Record<"user" | "department" | "source", readonly string[]>
  >,
) {
  const delegate = (model: "user" | "department" | "source") => ({
    findUnique: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        existing[model]?.includes(String(where["id"])) ? { ...where } : null,
    ),
  });
  return {
    user: delegate("user"),
    department: delegate("department"),
    source: delegate("source"),
  };
}

describe("verifyRelationOwnership", () => {
  it("no-ops for non-create operations", async () => {
    const client = makeClient({});
    await expect(
      verifyRelationOwnership(
        "UserDepartment",
        "findMany",
        { where: {} },
        verifyVia,
        client,
      ),
    ).resolves.toBeUndefined();
    expect(client.user.findUnique).not.toHaveBeenCalled();
  });

  it("resolves when the referenced foreign key belongs to the caller's org", async () => {
    const client = makeClient({ user: ["user-1"], department: ["dept-1"] });
    await expect(
      verifyRelationOwnership(
        "UserDepartment",
        "create",
        { data: { userId: "user-1", departmentId: "dept-1" } },
        verifyVia,
        client,
      ),
    ).resolves.toBeUndefined();
    expect(client.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(client.department.findUnique).toHaveBeenCalledWith({
      where: { id: "dept-1" },
    });
  });

  it("throws OrgScopeViolationError when the foreign key resolves to nothing under org scope", async () => {
    const client = makeClient({ department: ["dept-1"] });
    await expect(
      verifyRelationOwnership(
        "UserDepartment",
        "create",
        { data: { userId: "cross-org-user", departmentId: "dept-1" } },
        verifyVia,
        client,
      ),
    ).rejects.toThrow(OrgScopeViolationError);
  });

  it("rejects an in-scope user paired with another organization's department", async () => {
    const client = makeClient({ user: ["user-1"] });
    await expect(
      verifyRelationOwnership(
        "UserDepartment",
        "create",
        { data: { userId: "user-1", departmentId: "cross-org-dept" } },
        verifyVia,
        client,
      ),
    ).rejects.toThrow(OrgScopeViolationError);
  });

  it("verifies every distinct foreign key across a createMany batch", async () => {
    const client = makeClient({
      user: ["user-1", "user-2"],
      department: ["d1", "d2", "d3"],
    });
    await verifyRelationOwnership(
      "UserDepartment",
      "createMany",
      {
        data: [
          { userId: "user-1", departmentId: "d1" },
          { userId: "user-2", departmentId: "d2" },
          { userId: "user-1", departmentId: "d3" },
        ],
      },
      verifyVia,
      client,
    );
    expect(client.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rejects a createMany batch if any single item references a foreign org", async () => {
    const client = makeClient({
      user: ["user-1"],
      department: ["d1", "d2"],
    });
    await expect(
      verifyRelationOwnership(
        "UserDepartment",
        "createMany",
        {
          data: [
            { userId: "user-1", departmentId: "d1" },
            { userId: "cross-org-user", departmentId: "d2" },
          ],
        },
        verifyVia,
        client,
      ),
    ).rejects.toThrow(OrgScopeViolationError);
  });

  it("rejects scalar createMany data that references another organization", async () => {
    const client = makeClient({});
    await expect(
      verifyRelationOwnership(
        "Document",
        "createMany",
        { data: { sourceId: "cross-org-source", content: "secret" } },
        sourceVerifyVia,
        client,
      ),
    ).rejects.toThrow(OrgScopeViolationError);
    expect(client.source.findUnique).toHaveBeenCalledWith({
      where: { id: "cross-org-source" },
    });
  });

  it.each([
    ["create", { data: { source: { connect: { id: "cross-org-source" } } } }],
    ["update", { data: { source: { connect: { id: "cross-org-source" } } } }],
    [
      "upsert",
      {
        create: { source: { connect: { id: "source-1" } } },
        update: { source: { connect: { id: "cross-org-source" } } },
      },
    ],
  ])(
    "rejects cross-organization nested connect during %s",
    async (operation, args) => {
      const client = makeClient({ source: ["source-1"] });
      await expect(
        verifyRelationOwnership(
          "Document",
          operation,
          args,
          sourceVerifyVia,
          client,
        ),
      ).rejects.toThrow(OrgScopeViolationError);
    },
  );

  it("verifies scalar foreign-key set operations during update", async () => {
    const client = makeClient({});
    await expect(
      verifyRelationOwnership(
        "Document",
        "update",
        { data: { sourceId: { set: "cross-org-source" } } },
        sourceVerifyVia,
        client,
      ),
    ).rejects.toThrow(OrgScopeViolationError);
    expect(client.source.findUnique).toHaveBeenCalledWith({
      where: { id: "cross-org-source" },
    });
  });

  it("allows an in-scope scalar foreign-key update", async () => {
    const client = makeClient({ source: ["source-1"] });
    await expect(
      verifyRelationOwnership(
        "Document",
        "update",
        { data: { sourceId: "source-1" } },
        sourceVerifyVia,
        client,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows an in-scope nested connect during create", async () => {
    const client = makeClient({ source: ["source-1"] });
    await expect(
      verifyRelationOwnership(
        "Document",
        "create",
        { data: { source: { connect: { id: "source-1" } } } },
        sourceVerifyVia,
        client,
      ),
    ).resolves.toBeUndefined();
    expect(client.source.findUnique).toHaveBeenCalledWith({
      where: { id: "source-1" },
    });
  });

  it("rejects nested parent mutations other than connect", async () => {
    const client = makeClient({});
    await expect(
      verifyRelationOwnership(
        "Document",
        "create",
        { data: { source: { create: { name: "Bypass" } } } },
        sourceVerifyVia,
        client,
      ),
    ).rejects.toThrow(OrgScopeViolationError);
  });
});
