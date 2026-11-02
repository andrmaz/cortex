import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { Request } from "express";
import { BadRequestException } from "@nestjs/common";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { ContextBundleService } from "./context-bundle.service";
import { RetrievalService } from "../retrieval/retrieval.service";
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
  let retrieval: Mocked<RetrievalService>;

  beforeEach(() => {
    identityService = fromPartial<Mocked<IdentityService>>({
      resolveScope: vi.fn<IdentityService["resolveScope"]>().mockResolvedValue({
        organizationId: "org_456",
        departmentId: "dept_789",
      }),
    });
    retrieval = fromPartial<Mocked<RetrievalService>>({
      search: vi.fn<RetrievalService["search"]>().mockResolvedValue([
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
      ]),
    });
    controller = new MCPController(
      identityService,
      retrieval,
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

  it("searches only the caller's organization", async () => {
    await controller.handleMCP({ query: " q " }, makeReq());

    expect(retrieval.search).toHaveBeenCalledWith("q", "org_456");
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
    retrieval.search.mockResolvedValueOnce([]);

    const result = await controller.handleMCP({ query: "q" }, makeReq());

    expect(result.context).toEqual([]);
    expect(result.citations).toEqual([]);
  });

  it.each(["", "   "])("rejects blank query %j", async (query) => {
    await expect(
      controller.handleMCP({ query }, makeReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(retrieval.search).not.toHaveBeenCalled();
  });

  it("rejects a missing query", async () => {
    await expect(
      controller.handleMCP(fromAny({}), makeReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
