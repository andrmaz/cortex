import { computeScopedArgs, getScopeConfig } from "./scope-args.js";
import { UnknownOrgScopeModelError } from "./errors.js";

const ORG_ID = "org-1";

describe("getScopeConfig", () => {
  it("returns the registered config for a known model", () => {
    expect(getScopeConfig("User")).toEqual({
      kind: "direct",
      field: "organizationId",
    });
  });

  it("throws UnknownOrgScopeModelError for an unregistered model", () => {
    expect(() => getScopeConfig("NotAModel")).toThrow(
      UnknownOrgScopeModelError,
    );
  });
});

describe("computeScopedArgs — self scope (Organization)", () => {
  it("scopes findMany to the caller's own organization id", () => {
    const result = computeScopedArgs(
      { model: "Organization", operation: "findMany", args: {} },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: ORG_ID });
  });

  it("forces findUnique's id to the caller's own organization, regardless of what was requested", () => {
    // Prisma's WhereUniqueInput requires `id` to stay a direct top-level
    // field (AND-wrapping fails validation), so the scope filter overrides
    // the requested id in place rather than nesting a second constraint.
    const result = computeScopedArgs(
      {
        model: "Organization",
        operation: "findUnique",
        args: { where: { id: "some-other-org" } },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: ORG_ID });
  });

  it("forces update's id to the caller's own organization, regardless of what was requested", () => {
    const result = computeScopedArgs(
      {
        model: "Organization",
        operation: "update",
        args: { where: { id: "any-id" }, data: { name: "New Name" } },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: ORG_ID });
  });

  it("leaves create untouched (no existing org to scope against)", () => {
    const args = { data: { name: "New Org" } };
    const result = computeScopedArgs(
      { model: "Organization", operation: "create", args },
      ORG_ID,
    );
    expect(result).toEqual(args);
  });

  it("throws on an unrecognized operation", () => {
    expect(() =>
      computeScopedArgs(
        { model: "Organization", operation: "executeRaw", args: {} },
        ORG_ID,
      ),
    ).toThrow(/not a recognized read\/write operation/);
  });
});

describe("computeScopedArgs — direct scope (User, Department, ...)", () => {
  it("forces organizationId on create, overriding any caller-supplied value", () => {
    const result = computeScopedArgs(
      {
        model: "Department",
        operation: "create",
        args: { data: { name: "Eng", organizationId: "attacker-org" } },
      },
      ORG_ID,
    );
    expect(result["data"]).toEqual({ name: "Eng", organizationId: ORG_ID });
  });

  it("forces organizationId on every item of createMany", () => {
    const result = computeScopedArgs(
      {
        model: "Department",
        operation: "createMany",
        args: {
          data: [
            { name: "Eng", organizationId: "attacker-org" },
            { name: "Sales" },
          ],
        },
      },
      ORG_ID,
    );
    expect(result["data"]).toEqual([
      { name: "Eng", organizationId: ORG_ID },
      { name: "Sales", organizationId: ORG_ID },
    ]);
  });

  it("merges organizationId into where for findMany", () => {
    const result = computeScopedArgs(
      {
        model: "Department",
        operation: "findMany",
        args: { where: { name: "Eng" } },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({
      AND: [{ name: "Eng" }, { organizationId: ORG_ID }],
    });
  });

  it("merges organizationId alongside id for findUnique (extended-where lookup, not AND-wrapped)", () => {
    const result = computeScopedArgs(
      { model: "User", operation: "findUnique", args: { where: { id: "u1" } } },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: "u1", organizationId: ORG_ID });
  });

  it("scopes update's where (flat merge, not AND-wrapped) and strips organizationId from update data", () => {
    const result = computeScopedArgs(
      {
        model: "Department",
        operation: "update",
        args: {
          where: { id: "dept-1" },
          data: { name: "Renamed", organizationId: "attacker-org" },
        },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: "dept-1", organizationId: ORG_ID });
    expect(result["data"]).toEqual({ name: "Renamed" });
  });

  it("scopes updateMany and deleteMany where clauses", () => {
    const updateResult = computeScopedArgs(
      {
        model: "Department",
        operation: "updateMany",
        args: { where: { name: "Eng" }, data: { name: "Engineering" } },
      },
      ORG_ID,
    );
    expect(updateResult["where"]).toEqual({
      AND: [{ name: "Eng" }, { organizationId: ORG_ID }],
    });

    const deleteResult = computeScopedArgs(
      { model: "Department", operation: "deleteMany", args: { where: {} } },
      ORG_ID,
    );
    expect(deleteResult["where"]).toEqual({ organizationId: ORG_ID });
  });

  it("scopes delete's where clause (flat merge, not AND-wrapped)", () => {
    const result = computeScopedArgs(
      {
        model: "Department",
        operation: "delete",
        args: { where: { id: "dept-1" } },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: "dept-1", organizationId: ORG_ID });
  });

  it("scopes upsert: forces organizationId on create, scopes where (flat merge), strips it from update", () => {
    const result = computeScopedArgs(
      {
        model: "Department",
        operation: "upsert",
        args: {
          where: { id: "dept-1" },
          create: { name: "Eng", organizationId: "attacker-org" },
          update: { name: "Eng2", organizationId: "attacker-org" },
        },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ id: "dept-1", organizationId: ORG_ID });
    expect(result["create"]).toEqual({ name: "Eng", organizationId: ORG_ID });
    expect(result["update"]).toEqual({ name: "Eng2" });
  });

  it("throws on an unrecognized operation", () => {
    expect(() =>
      computeScopedArgs(
        { model: "User", operation: "mystery", args: {} },
        ORG_ID,
      ),
    ).toThrow(/not a recognized read\/write operation/);
  });
});

describe("computeScopedArgs — relation scope (UserDepartment, Document, Chunk, QueryLog)", () => {
  it("merges a single-hop relation filter for UserDepartment reads", () => {
    const result = computeScopedArgs(
      {
        model: "UserDepartment",
        operation: "findMany",
        args: { where: { userId: "u1" } },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({
      AND: [{ userId: "u1" }, { user: { organizationId: ORG_ID } }],
    });
  });

  it("merges a multi-hop relation filter for Chunk reads", () => {
    const result = computeScopedArgs(
      { model: "Chunk", operation: "findMany", args: {} },
      ORG_ID,
    );
    expect(result["where"]).toEqual({
      document: { source: { organizationId: ORG_ID } },
    });
  });

  it("scopes updateMany/deleteMany via the relation filter", () => {
    const result = computeScopedArgs(
      { model: "QueryLog", operation: "deleteMany", args: {} },
      ORG_ID,
    );
    expect(result["where"]).toEqual({ user: { organizationId: ORG_ID } });
  });

  it("merges a relation filter alongside a unique identifier (flat merge, not AND-wrapped)", () => {
    const result = computeScopedArgs(
      {
        model: "UserDepartment",
        operation: "findUnique",
        args: {
          where: { userId_departmentId: { userId: "u1", departmentId: "d1" } },
        },
      },
      ORG_ID,
    );
    expect(result["where"]).toEqual({
      userId_departmentId: { userId: "u1", departmentId: "d1" },
      user: { organizationId: ORG_ID },
    });
  });

  it("leaves create/createMany args untouched (verified separately via a DB round trip)", () => {
    const args = { data: { userId: "u1", departmentId: "d1" } };
    const result = computeScopedArgs(
      { model: "UserDepartment", operation: "create", args },
      ORG_ID,
    );
    expect(result).toEqual(args);
  });

  it("throws on an unrecognized operation", () => {
    expect(() =>
      computeScopedArgs(
        { model: "Document", operation: "mystery", args: {} },
        ORG_ID,
      ),
    ).toThrow(/not a recognized read\/write operation/);
  });
});
