import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MAX_QUERY_LOG_LIMIT,
  QueryLogAdminService,
} from "./query-log-admin.service";

const mockPrisma = {
  organization: { findUnique: vi.fn() },
  department: { findMany: vi.fn() },
  queryLog: { findMany: vi.fn() },
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    userId: "user-1",
    organizationId: "org-1",
    departmentId: "dept-gone",
    query: "hello",
    contextBundle: {
      citations: [
        {
          chunkId: "c1",
          documentId: "d1",
          sourceId: "s1",
          score: 0.5,
          content: "secret",
        },
      ],
    },
    policyDecision: null,
    response: "r",
    latencyMs: null,
    createdAt: new Date("2024-06-01T00:00:00Z"),
    user: { email: "alice@acme.com" },
    ...overrides,
  };
}

describe("QueryLogAdminService", () => {
  let service: QueryLogAdminService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    mockPrisma.department.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        QueryLogAdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = moduleRef.get(QueryLogAdminService);
  });

  it("throws NotFoundException for an unknown organization", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(service.list("missing", {})).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.queryLog.findMany).not.toHaveBeenCalled();
  });

  it("falls back to a null department name and strips citation content", async () => {
    mockPrisma.queryLog.findMany.mockResolvedValue([row()]);

    const { items } = await service.list("org-1", {});

    expect(items[0]?.department).toEqual({ id: "dept-gone", name: null });
    expect(items[0]?.policyDecision).toBeNull();
    expect(items[0]?.citations).toEqual([
      { chunkId: "c1", documentId: "d1", sourceId: "s1", score: 0.5 },
    ]);
  });

  it("handles rows without department or bundle", async () => {
    mockPrisma.queryLog.findMany.mockResolvedValue([
      row({ departmentId: null, contextBundle: null }),
    ]);

    const { items } = await service.list("org-1", {});

    expect(items[0]?.department).toBeNull();
    expect(items[0]?.citations).toEqual([]);
    expect(mockPrisma.department.findMany).not.toHaveBeenCalled();
  });

  it("clamps the limit and reports the next cursor", async () => {
    mockPrisma.queryLog.findMany.mockResolvedValue([
      row({ id: "q1" }),
      row({ id: "q2" }),
    ]);

    const page = await service.list("org-1", { limit: 1 });

    expect(page.items.map((i) => i.id)).toEqual(["q1"]);
    expect(page.nextCursor).toBe("q2");

    await service.list("org-1", { limit: 10_000 });
    expect(mockPrisma.queryLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: MAX_QUERY_LOG_LIMIT + 1 }),
    );
  });
});
