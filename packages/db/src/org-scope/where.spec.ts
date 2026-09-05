import {
  buildRelationFilter,
  isPlainObject,
  mergeUniqueWhere,
  mergeWhere,
  stripField,
} from "./where.js";

describe("isPlainObject", () => {
  it("returns true for plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it("returns false for arrays, null, and primitives", () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject("x")).toBe(false);
    expect(isPlainObject(1)).toBe(false);
  });
});

describe("buildRelationFilter", () => {
  it("builds a single-level relation filter", () => {
    expect(buildRelationFilter(["user", "organizationId"], "org-1")).toEqual({
      user: { organizationId: "org-1" },
    });
  });

  it("builds a multi-level nested relation filter", () => {
    expect(
      buildRelationFilter(["document", "source", "organizationId"], "org-1"),
    ).toEqual({
      document: { source: { organizationId: "org-1" } },
    });
  });
});

describe("mergeWhere", () => {
  const scopeFilter = { organizationId: "org-1" };

  it("returns the scope filter directly when where is undefined", () => {
    expect(mergeWhere(undefined, scopeFilter)).toEqual(scopeFilter);
  });

  it("returns the scope filter directly when where is an empty object", () => {
    expect(mergeWhere({}, scopeFilter)).toEqual(scopeFilter);
  });

  it("returns the scope filter directly when where is not an object", () => {
    expect(mergeWhere("not-an-object", scopeFilter)).toEqual(scopeFilter);
    expect(mergeWhere(null, scopeFilter)).toEqual(scopeFilter);
  });

  it("wraps an existing where in AND alongside the scope filter", () => {
    const callerWhere = { name: "Engineering" };
    expect(mergeWhere(callerWhere, scopeFilter)).toEqual({
      AND: [callerWhere, scopeFilter],
    });
  });

  it("never lets the scope filter be shadowed by a colliding caller key", () => {
    const callerWhere = { organizationId: "attacker-org" };
    const result = mergeWhere(callerWhere, scopeFilter);
    expect(result).toEqual({ AND: [callerWhere, scopeFilter] });
    // The scope filter is the last AND clause, so it always narrows the
    // result regardless of what the caller supplied.
    expect((result["AND"] as unknown[])[1]).toEqual(scopeFilter);
  });
});

describe("mergeUniqueWhere", () => {
  const scopeFilter = { organizationId: "org-1" };

  it("returns just the scope filter when where is undefined", () => {
    expect(mergeUniqueWhere(undefined, scopeFilter)).toEqual(scopeFilter);
  });

  it("keeps the caller's unique identifier flat alongside the scope filter (no AND-wrapping)", () => {
    // Prisma's WhereUniqueInput requires the unique field (e.g. `id`) to
    // remain a direct top-level property — AND-wrapping fails validation.
    const callerWhere = { id: "user-1" };
    expect(mergeUniqueWhere(callerWhere, scopeFilter)).toEqual({
      id: "user-1",
      organizationId: "org-1",
    });
  });

  it("lets the scope filter win when a key collides with the caller's where", () => {
    const callerWhere = { id: "org-1", organizationId: "attacker-org" };
    expect(mergeUniqueWhere(callerWhere, scopeFilter)).toEqual({
      id: "org-1",
      organizationId: "org-1",
    });
  });

  it("overrides the requested id with the caller's own org id for self-scoped models", () => {
    // For the `Organization` model, the scope filter's key IS the unique
    // identifier (`id`), so this is how a mismatched request gets forced
    // back onto the caller's own org rather than AND-wrapping (unsupported).
    const callerWhere = { id: "some-other-org" };
    expect(mergeUniqueWhere(callerWhere, { id: "org-1" })).toEqual({
      id: "org-1",
    });
  });

  it("preserves relation filters alongside a unique identifier", () => {
    const callerWhere = {
      userId_departmentId: { userId: "u1", departmentId: "d1" },
    };
    const relationFilter = { user: { organizationId: "org-1" } };
    expect(mergeUniqueWhere(callerWhere, relationFilter)).toEqual({
      userId_departmentId: { userId: "u1", departmentId: "d1" },
      user: { organizationId: "org-1" },
    });
  });
});

describe("stripField", () => {
  it("removes the given field when present", () => {
    expect(
      stripField({ organizationId: "org-1", name: "x" }, "organizationId"),
    ).toEqual({
      name: "x",
    });
  });

  it("returns the object unchanged (by value) when the field is absent", () => {
    const data = { name: "x" };
    expect(stripField(data, "organizationId")).toEqual({ name: "x" });
  });

  it("does not mutate the input object", () => {
    const data = { organizationId: "org-1", name: "x" };
    stripField(data, "organizationId");
    expect(data).toEqual({ organizationId: "org-1", name: "x" });
  });
});
