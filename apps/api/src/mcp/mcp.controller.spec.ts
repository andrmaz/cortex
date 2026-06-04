import { MCPController } from "./mcp.controller";
import type { MCPRequest } from "@cortex/shared";

describe("MCPController", () => {
  let controller: MCPController;

  beforeEach(() => {
    controller = new MCPController();
  });

  describe("handleMCP", () => {
    const validRequest: MCPRequest = {
      userId: "user_123",
      organizationId: "org_456",
      departmentId: "dept_789",
      query: "What is the coding standard?",
    };

    it("should return a response with context, policy, and answer", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("policy");
      expect(result).toHaveProperty("answer");
    });

    it("should return the fixed context array with company architecture entries", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result.context).toEqual([
        "Company uses modular monolith architecture",
        "No direct DB access from controllers",
      ]);
    });

    it("should return exactly two context entries", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result.context).toHaveLength(2);
    });

    it("should return the fixed policy with TypeScript and clean architecture rules", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result.policy).toEqual({
        rules: ["Use TypeScript", "Follow clean architecture"],
      });
    });

    it("should return policy rules as an array with exactly two entries", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result.policy.rules).toHaveLength(2);
      expect(Array.isArray(result.policy.rules)).toBe(true);
    });

    it("should include the query in the answer using the expected format", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result.answer).toBe(
        "Based on company standards: What is the coding standard?"
      );
    });

    it("should prefix the answer with 'Based on company standards: '", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(result.answer).toMatch(/^Based on company standards: /);
    });

    it("should reflect the query verbatim in the answer", async () => {
      const query = "How do I structure my service layer?";
      const result = await controller.handleMCP({ ...validRequest, query });

      expect(result.answer).toBe(`Based on company standards: ${query}`);
    });

    it("should handle an empty query string", async () => {
      const result = await controller.handleMCP({ ...validRequest, query: "" });

      expect(result.answer).toBe("Based on company standards: ");
      expect(result.context).toHaveLength(2);
      expect(result.policy.rules).toHaveLength(2);
    });

    it("should handle a query with special characters", async () => {
      const specialQuery = 'What about "quotes" & <angle> brackets?';
      const result = await controller.handleMCP({
        ...validRequest,
        query: specialQuery,
      });

      expect(result.answer).toBe(`Based on company standards: ${specialQuery}`);
    });

    it("should handle a query with newlines and whitespace", async () => {
      const multilineQuery = "First line\nSecond line\t tabbed";
      const result = await controller.handleMCP({
        ...validRequest,
        query: multilineQuery,
      });

      expect(result.answer).toBe(
        `Based on company standards: ${multilineQuery}`
      );
    });

    it("should not use userId in the response", async () => {
      const resultA = await controller.handleMCP({
        ...validRequest,
        userId: "user_aaa",
      });
      const resultB = await controller.handleMCP({
        ...validRequest,
        userId: "user_bbb",
      });

      expect(resultA.answer).toBe(resultB.answer);
      expect(resultA.context).toEqual(resultB.context);
      expect(resultA.policy).toEqual(resultB.policy);
    });

    it("should not use organizationId in the response", async () => {
      const resultA = await controller.handleMCP({
        ...validRequest,
        organizationId: "org_111",
      });
      const resultB = await controller.handleMCP({
        ...validRequest,
        organizationId: "org_999",
      });

      expect(resultA.answer).toBe(resultB.answer);
      expect(resultA.context).toEqual(resultB.context);
      expect(resultA.policy).toEqual(resultB.policy);
    });

    it("should not use departmentId in the response", async () => {
      const resultA = await controller.handleMCP({
        ...validRequest,
        departmentId: "dept_aaa",
      });
      const resultB = await controller.handleMCP({
        ...validRequest,
        departmentId: "dept_zzz",
      });

      expect(resultA.answer).toBe(resultB.answer);
      expect(resultA.context).toEqual(resultB.context);
      expect(resultA.policy).toEqual(resultB.policy);
    });

    it("should return consistent context regardless of query", async () => {
      const result1 = await controller.handleMCP({
        ...validRequest,
        query: "query one",
      });
      const result2 = await controller.handleMCP({
        ...validRequest,
        query: "query two",
      });

      expect(result1.context).toEqual(result2.context);
    });

    it("should return consistent policy regardless of query", async () => {
      const result1 = await controller.handleMCP({
        ...validRequest,
        query: "query one",
      });
      const result2 = await controller.handleMCP({
        ...validRequest,
        query: "completely different query",
      });

      expect(result1.policy).toEqual(result2.policy);
    });

    it("should return a Promise (async method)", () => {
      const returnValue = controller.handleMCP(validRequest);

      expect(returnValue).toBeInstanceOf(Promise);
    });

    it("should return context as an array of strings", async () => {
      const result = await controller.handleMCP(validRequest);

      result.context.forEach((item) => {
        expect(typeof item).toBe("string");
      });
    });

    it("should return policy rules as an array of strings", async () => {
      const result = await controller.handleMCP(validRequest);

      result.policy.rules.forEach((rule) => {
        expect(typeof rule).toBe("string");
      });
    });

    it("should return answer as a string", async () => {
      const result = await controller.handleMCP(validRequest);

      expect(typeof result.answer).toBe("string");
    });

    it("should handle a very long query string", async () => {
      const longQuery = "A".repeat(10000);
      const result = await controller.handleMCP({
        ...validRequest,
        query: longQuery,
      });

      expect(result.answer).toBe(`Based on company standards: ${longQuery}`);
    });
  });
});