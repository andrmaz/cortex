import { verifyRelationOwnership } from "./verify-relation.js";
import { OrgScopeViolationError } from "./errors.js";
import type { RelationVerification } from "./config.js";

const verifyVia: RelationVerification = {
  foreignKeyField: "userId",
  parentModel: "User",
};

function makeClient(existingIds: readonly string[]) {
  return {
    user: {
      findUnique: jest.fn(
        async ({ where: { id } }: { where: { id: string } }) =>
          existingIds.includes(id) ? { id } : null,
      ),
    },
  };
}

describe("verifyRelationOwnership", () => {
  it("no-ops for non-create operations", async () => {
    const client = makeClient([]);
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
    const client = makeClient(["user-1"]);
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
  });

  it("throws OrgScopeViolationError when the foreign key resolves to nothing under org scope", async () => {
    const client = makeClient([]);
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

  it("verifies every distinct foreign key across a createMany batch", async () => {
    const client = makeClient(["user-1", "user-2"]);
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
    const client = makeClient(["user-1"]);
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
});
