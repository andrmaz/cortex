import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { Request } from "express";
import { BadRequestException } from "@nestjs/common";
import type { PolicyDecision } from "@cortex/shared/policy";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { ContextBundleService } from "./context-bundle.service";
import { PolicyRuntimeService } from "../policy/policy-runtime.service";
import type { RetrievedChunk } from "../retrieval/retrieval.service";
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
  let identityService: Mocked<IdentityService>;
  let policies: Mocked<PolicyRuntimeService>;
  let chunks: RetrievedChunk[];

  const allowed: PolicyDecision = {
    policyId: "policy_1",
    policyVersion: 1,
    decision: "allow",
    matchedRules: [],
    reasonCode: null,
    reason: null,
  };

  beforeEach(() => {
    chunks = [
      {
        chunkId: "c1",
        content: "We use a modular monolith.",
        score: 0.92,
        sourceRef: {
          sourceId: "s1",
          documentId: "d1",
          fileName: "arch.txt",
        },
      },
    ];
    identityService = fromPartial<Mocked<IdentityService>>({
      resolveScope: vi.fn<IdentityService["resolveScope"]>().mockResolvedValue({
        organizationId: "org_456",
        departmentId: "dept_789",
      }),
    });
    policies = fromPartial<Mocked<PolicyRuntimeService>>({
      evaluate: vi
        .fn<PolicyRuntimeService["evaluate"]>()
        .mockImplementation(async () => ({ chunks, decision: allowed })),
    });
    controller = new MCPController(
      identityService,
      policies,
      new ContextBundleService(),
    );
  });

  it("resolves scope from the JWT user", async () => {
    await controller.handleMCP({ query: "q" }, makeReq());

    expect(identityService.resolveScope).toHaveBeenCalledWith(
      "user_123",
      "org_456",
    );
  });

  it("evaluates policy with the resolved caller scope", async () => {
    await controller.handleMCP({ query: " q " }, makeReq());

    expect(policies.evaluate).toHaveBeenCalledWith(
      { organizationId: "org_456", departmentId: "dept_789" },
      "q",
    );
  });

  it("returns retrieved context, citations and a grounded answer", async () => {
    const result = await controller.handleMCP({ query: "arch?" }, makeReq());

    expect(result.context).toEqual(["We use a modular monolith."]);
    expect(result.citations).toEqual([
      {
        chunkId: "c1",
        documentId: "d1",
        sourceId: "s1",
        fileName: "arch.txt",
        score: 0.92,
      },
    ]);
    expect(result.answer).toContain("We use a modular monolith.");
    expect(result.scope.departmentId).toBe("dept_789");
  });

  it("returns empty context and citations when nothing matches", async () => {
    chunks = [];

    const result = await controller.handleMCP({ query: "q" }, makeReq());

    expect(result.context).toEqual([]);
    expect(result.citations).toEqual([]);
  });

  it.each(["", "   "])("rejects blank query %j", async (query) => {
    await expect(
      controller.handleMCP({ query }, makeReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(policies.evaluate).not.toHaveBeenCalled();
  });

  it("rejects a missing query", async () => {
    await expect(
      controller.handleMCP(fromAny({}), makeReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
