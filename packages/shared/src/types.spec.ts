import type { MCPRequest } from "./types";

// Runtime helper: create a valid MCPRequest-shaped object and validate its structure
function createMCPRequest(overrides: Partial<MCPRequest> = {}): MCPRequest {
  return {
    userId: "user_123",
    organizationId: "org_456",
    departmentId: "dept_789",
    query: "What is the architecture?",
    ...overrides,
  };
}

describe("MCPRequest type", () => {
  describe("required fields", () => {
    it("should accept an object with all required fields", () => {
      const request = createMCPRequest();

      expect(request.userId).toBeDefined();
      expect(request.organizationId).toBeDefined();
      expect(request.departmentId).toBeDefined();
      expect(request.query).toBeDefined();
    });

    it("should have userId as a string", () => {
      const request = createMCPRequest({ userId: "user_abc" });

      expect(typeof request.userId).toBe("string");
      expect(request.userId).toBe("user_abc");
    });

    it("should have organizationId as a string", () => {
      const request = createMCPRequest({ organizationId: "org_xyz" });

      expect(typeof request.organizationId).toBe("string");
      expect(request.organizationId).toBe("org_xyz");
    });

    it("should have departmentId as a string", () => {
      const request = createMCPRequest({ departmentId: "dept_eng" });

      expect(typeof request.departmentId).toBe("string");
      expect(request.departmentId).toBe("dept_eng");
    });

    it("should have query as a string", () => {
      const request = createMCPRequest({ query: "How do I test?" });

      expect(typeof request.query).toBe("string");
      expect(request.query).toBe("How do I test?");
    });

    it("should have exactly four fields", () => {
      const request = createMCPRequest();

      expect(Object.keys(request)).toHaveLength(4);
    });

    it("should preserve all four field names as object keys", () => {
      const request = createMCPRequest();
      const keys = Object.keys(request);

      expect(keys).toContain("userId");
      expect(keys).toContain("organizationId");
      expect(keys).toContain("departmentId");
      expect(keys).toContain("query");
    });
  });

  describe("field values", () => {
    it("should accept an empty string for userId", () => {
      const request = createMCPRequest({ userId: "" });

      expect(request.userId).toBe("");
    });

    it("should accept an empty string for organizationId", () => {
      const request = createMCPRequest({ organizationId: "" });

      expect(request.organizationId).toBe("");
    });

    it("should accept an empty string for departmentId", () => {
      const request = createMCPRequest({ departmentId: "" });

      expect(request.departmentId).toBe("");
    });

    it("should accept an empty string for query", () => {
      const request = createMCPRequest({ query: "" });

      expect(request.query).toBe("");
    });

    it("should accept UUID-formatted userId", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const request = createMCPRequest({ userId: uuid });

      expect(request.userId).toBe(uuid);
    });

    it("should accept UUID-formatted organizationId", () => {
      const uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      const request = createMCPRequest({ organizationId: uuid });

      expect(request.organizationId).toBe(uuid);
    });

    it("should accept UUID-formatted departmentId", () => {
      const uuid = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
      const request = createMCPRequest({ departmentId: uuid });

      expect(request.departmentId).toBe(uuid);
    });

    it("should accept a multi-line query", () => {
      const multiline = "Line 1\nLine 2\nLine 3";
      const request = createMCPRequest({ query: multiline });

      expect(request.query).toBe(multiline);
    });

    it("should accept special characters in query", () => {
      const special = 'SELECT * FROM users WHERE name = "admin"; --';
      const request = createMCPRequest({ query: special });

      expect(request.query).toBe(special);
    });

    it("should accept a very long query", () => {
      const longQuery = "word ".repeat(1000).trim();
      const request = createMCPRequest({ query: longQuery });

      expect(request.query).toBe(longQuery);
    });
  });

  describe("object identity and immutability behavior", () => {
    it("should create distinct objects for each call to createMCPRequest", () => {
      const req1 = createMCPRequest({ userId: "user_1" });
      const req2 = createMCPRequest({ userId: "user_2" });

      expect(req1).not.toBe(req2);
      expect(req1.userId).not.toBe(req2.userId);
    });

    it("should not share references between separate request objects", () => {
      const req1 = createMCPRequest({ query: "first" });
      const req2 = createMCPRequest({ query: "second" });

      req1.query = "mutated";
      expect(req2.query).toBe("second");
    });
  });
});