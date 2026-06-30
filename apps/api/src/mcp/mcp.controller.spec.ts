import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { Request } from "express";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import type { AuthenticatedUser } from "../auth/auth.types";

type RequestWithJwtUser = Request & { user: AuthenticatedUser };

const mockUser: AuthenticatedUser = {
  id: "user_123",
  email: "alice@example.com",
  organizationId: "org_456",
  role: "member",
};

function makeReq(user: AuthenticatedUser = mockUser): RequestWithJwtUser {
  return fromAny({ user });
}

describe("MCPController", () => {
  let controller: MCPController;
  let identityService: jest.Mocked<IdentityService>;

  beforeEach(() => {
    identityService = fromPartial<jest.Mocked<IdentityService>>({
      resolveScope: jest.fn().mockResolvedValue({
        organizationId: "org_456",
        departmentId: "dept_789",
      }),
    });

    controller = new MCPController(identityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleMCP", () => {
    it("returns a response with scope, context, policy, and answer", async () => {
      const result = await controller.handleMCP(
        { query: "What is the coding standard?" },
        makeReq(),
      );

      expect(result).toHaveProperty("scope");
      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("policy");
      expect(result).toHaveProperty("answer");
    });

    it("delegates identity resolution to IdentityService with userId and organizationId from req.user", async () => {
      await controller.handleMCP(
        { query: "test" },
        makeReq(mockUser),
      );

      expect(identityService.resolveScope).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.organizationId,
      );
    });

    it("includes the resolved organizationId and departmentId in scope", async () => {
      identityService.resolveScope.mockResolvedValueOnce({
        organizationId: "org_abc",
        departmentId: "dept_xyz",
      });

      const result = await controller.handleMCP(
        { query: "test" },
        makeReq({ ...mockUser, organizationId: "org_abc" }),
      );

      expect(result.scope).toEqual({
        organizationId: "org_abc",
        departmentId: "dept_xyz",
      });
    });

    it("returns null departmentId when user has no primary department", async () => {
      identityService.resolveScope.mockResolvedValueOnce({
        organizationId: "org_456",
        departmentId: null,
      });

      const result = await controller.handleMCP(
        { query: "test" },
        makeReq(),
      );

      expect(result.scope.departmentId).toBeNull();
    });

    it("includes the query verbatim in the answer", async () => {
      const result = await controller.handleMCP(
        { query: "How do I structure my service layer?" },
        makeReq(),
      );

      expect(result.answer).toBe(
        "Based on company standards: How do I structure my service layer?",
      );
    });

    it("prefixes the answer with 'Based on company standards: '", async () => {
      const result = await controller.handleMCP(
        { query: "any question" },
        makeReq(),
      );

      expect(result.answer).toMatch(/^Based on company standards: /);
    });

    it("returns the stub context array", async () => {
      const result = await controller.handleMCP(
        { query: "test" },
        makeReq(),
      );

      expect(result.context).toEqual([
        "Company uses modular monolith architecture",
        "No direct DB access from controllers",
      ]);
    });

    it("returns the stub policy with TypeScript and clean architecture rules", async () => {
      const result = await controller.handleMCP(
        { query: "test" },
        makeReq(),
      );

      expect(result.policy).toEqual({
        rules: ["Use TypeScript", "Follow clean architecture"],
      });
    });

    it("returns a Promise (async method)", () => {
      const returnValue = controller.handleMCP(
        { query: "test" },
        makeReq(),
      );

      expect(returnValue).toBeInstanceOf(Promise);
    });

    it("handles an empty query string", async () => {
      const result = await controller.handleMCP({ query: "" }, makeReq());

      expect(result.answer).toBe("Based on company standards: ");
      expect(result.context).toHaveLength(2);
      expect(result.policy.rules).toHaveLength(2);
    });

    it("handles a query with special characters", async () => {
      const specialQuery = 'What about "quotes" & <angle> brackets?';
      const result = await controller.handleMCP(
        { query: specialQuery },
        makeReq(),
      );

      expect(result.answer).toBe(`Based on company standards: ${specialQuery}`);
    });

    it("calls resolveScope once per request", async () => {
      await controller.handleMCP({ query: "a" }, makeReq());
      await controller.handleMCP({ query: "b" }, makeReq());

      expect(identityService.resolveScope).toHaveBeenCalledTimes(2);
    });

    it("passes different users to resolveScope correctly", async () => {
      const userA: AuthenticatedUser = {
        id: "user_aaa",
        email: "a@example.com",
        organizationId: "org_111",
        role: "member",
      };
      const userB: AuthenticatedUser = {
        id: "user_bbb",
        email: "b@example.com",
        organizationId: "org_222",
        role: "admin",
      };

      await controller.handleMCP({ query: "q" }, makeReq(userA));
      await controller.handleMCP({ query: "q" }, makeReq(userB));

      expect(identityService.resolveScope).toHaveBeenNthCalledWith(
        1,
        "user_aaa",
        "org_111",
      );
      expect(identityService.resolveScope).toHaveBeenNthCalledWith(
        2,
        "user_bbb",
        "org_222",
      );
    });

    it("returns answer as a string", async () => {
      const result = await controller.handleMCP({ query: "test" }, makeReq());

      expect(typeof result.answer).toBe("string");
    });

    it("returns context as an array of strings", async () => {
      const result = await controller.handleMCP({ query: "test" }, makeReq());

      result.context.forEach((item) => expect(typeof item).toBe("string"));
    });

    it("returns policy rules as an array of strings", async () => {
      const result = await controller.handleMCP({ query: "test" }, makeReq());

      result.policy.rules.forEach((rule) => expect(typeof rule).toBe("string"));
    });

    it("handles a very long query string", async () => {
      const longQuery = "A".repeat(10000);
      const result = await controller.handleMCP(
        { query: longQuery },
        makeReq(),
      );

      expect(result.answer).toBe(`Based on company standards: ${longQuery}`);
    });
  });
});
