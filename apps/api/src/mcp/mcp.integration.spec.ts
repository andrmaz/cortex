import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { getOrgContext } from "db";
import { MCPModule } from "./mcp.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleStrategy } from "../auth/strategies/google.strategy";
import { OrgContextInterceptor } from "../common/org-context.interceptor";
import { RetrievalService } from "../retrieval/retrieval.service";

const TEST_JWT_SECRET = "test-secret-for-mcp-integration";

/** Stub so tests don't require real OAuth credentials. */
class MockGoogleStrategy {
  name = "google";
}

const mockRetrieval = { search: vi.fn() };

const mockPrisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  user: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  userDepartment: { findFirst: vi.fn() },
  queryLog: { create: vi.fn().mockResolvedValue({}) },
  policy: {
    findFirst: vi
      .fn()
      .mockImplementation(
        async ({
          where,
        }: {
          where: { organizationId: string; departmentId: string };
        }) => ({
          id: `policy-${where.organizationId}`,
          version: 1,
          rulesJson: {
            schemaVersion: 1,
            allowedSourceIds: ["source-allowed"],
            rules: [],
          },
        }),
      ),
  },
};

function issueToken(
  payload: {
    sub: string;
    email: string;
    organizationId: string;
    role: string;
  },
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: "1h",
    ...options,
  });
}

describe("MCP Integration", () => {
  let app: INestApplication;
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [MCPModule, AuthModule],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
      ],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(RetrievalService)
      .useValue(mockRetrieval)
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousJwtSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = previousJwtSecret;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRetrieval.search.mockResolvedValue([]);
  });

  describe("authenticated happy path", () => {
    it("returns 201 with scope, context, policy, and answer for a valid JWT", async () => {
      const token = issueToken({
        sub: "user_123",
        email: "alice@example.com",
        organizationId: "org_456",
        role: "member",
      });

      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce({
        id: "ud_1",
        userId: "user_123",
        departmentId: "dept_789",
        isPrimary: true,
      });

      const response = await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "What are the coding standards?" })
        .expect(201);

      expect(response.body).toMatchObject({
        scope: {
          organizationId: "org_456",
          departmentId: "dept_789",
        },
      });
      expect(response.body.answer).toBe("No relevant context found.");
      expect(Array.isArray(response.body.context)).toBe(true);
      expect(response.body.policy.decision).toBe("allow");
    });

    it("resolves organizationId from JWT claim, not from request body", async () => {
      const token = issueToken({
        sub: "user_123",
        email: "alice@example.com",
        organizationId: "org_from_jwt",
        role: "member",
      });

      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "test" })
        .expect(201);

      expect(response.body.scope.organizationId).toBe("org_from_jwt");
    });

    it("returns null departmentId when user has no primary department", async () => {
      const token = issueToken({
        sub: "user_no_dept",
        email: "nodept@example.com",
        organizationId: "org_456",
        role: "member",
      });

      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "test" })
        .expect(201);

      expect(response.body.scope.departmentId).toBeNull();
    });
  });

  describe("organization isolation", () => {
    it("binds the JWT organizationId as the query-layer org context for the request", async () => {
      const token = issueToken({
        sub: "user_123",
        email: "alice@example.com",
        organizationId: "org_456",
        role: "member",
      });

      let seen: ReturnType<typeof getOrgContext>;
      mockPrisma.userDepartment.findFirst.mockImplementation(async () => {
        seen = getOrgContext();
        return null;
      });

      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "test" })
        .expect(201);

      expect(seen).toEqual({ organizationId: "org_456" });
    });

    it("scopes the userDepartment lookup by the caller's own organization", async () => {
      const token = issueToken({
        sub: "user_123",
        email: "alice@example.com",
        organizationId: "org_456",
        role: "member",
      });

      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "test" })
        .expect(201);

      expect(mockPrisma.userDepartment.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user_123",
          isPrimary: true,
          department: { organizationId: "org_456" },
        },
      });
    });

    it("keeps concurrent requests from different organizations fully isolated", async () => {
      const tokenA = issueToken({
        sub: "user_a",
        email: "a@a-corp.example.com",
        organizationId: "org_a",
        role: "member",
      });
      const tokenB = issueToken({
        sub: "user_b",
        email: "b@b-corp.example.com",
        organizationId: "org_b",
        role: "member",
      });

      mockPrisma.userDepartment.findFirst.mockImplementation(
        async ({ where }: { where: { userId: string } }) => {
          if (where.userId === "user_a") {
            return {
              id: "ud_a",
              userId: "user_a",
              departmentId: "dept_a",
              isPrimary: true,
            };
          }
          if (where.userId === "user_b") {
            return {
              id: "ud_b",
              userId: "user_b",
              departmentId: "dept_b",
              isPrimary: true,
            };
          }
          return null;
        },
      );

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post("/mcp")
          .set("Authorization", `Bearer ${tokenA}`)
          .send({ query: "query from org A" }),
        request(app.getHttpServer())
          .post("/mcp")
          .set("Authorization", `Bearer ${tokenB}`)
          .send({ query: "query from org B" }),
      ]);

      expect(resA.body.scope).toEqual({
        organizationId: "org_a",
        departmentId: "dept_a",
      });
      expect(resB.body.scope).toEqual({
        organizationId: "org_b",
        departmentId: "dept_b",
      });
      expect(mockRetrieval.search).toHaveBeenCalledWith(
        "query from org A",
        "org_a",
        undefined,
        ["source-allowed"],
      );
      expect(mockRetrieval.search).toHaveBeenCalledWith(
        "query from org B",
        "org_b",
        undefined,
        ["source-allowed"],
      );
    });

    it("never returns another organization's departmentId even if that org's row is isPrimary in the same result set", async () => {
      // Regression guard: the relation filter on `department.organizationId`
      // is what prevents this, not incidental ordering of mock data.
      const token = issueToken({
        sub: "user_123",
        email: "alice@example.com",
        organizationId: "org_456",
        role: "member",
      });

      mockPrisma.userDepartment.findFirst.mockImplementationOnce(
        async ({
          where,
        }: {
          where: { department: { organizationId: string } };
        }) => {
          // Simulate a correctly org-scoped query engine: a row belonging to
          // a foreign org must never satisfy this filter.
          if (where.department.organizationId !== "org_456") {
            return null;
          }
          return {
            id: "ud_1",
            userId: "user_123",
            departmentId: "dept_456",
            isPrimary: true,
          };
        },
      );

      const response = await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .send({ query: "test" })
        .expect(201);

      expect(response.body.scope.departmentId).toBe("dept_456");
    });
  });

  describe("QueryLog audit", () => {
    const token = () =>
      issueToken({
        sub: "user_123",
        email: "alice@example.com",
        organizationId: "org_456",
        role: "member",
      });

    it("appends a QueryLog entry for an allowed query", async () => {
      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce({
        departmentId: "dept_789",
        isPrimary: true,
      });
      mockRetrieval.search.mockResolvedValueOnce([
        {
          chunkId: "chunk-1",
          content: "Coding standards text",
          score: 0.9,
          sourceRef: { sourceId: "source-allowed", documentId: "doc-1" },
        },
      ]);

      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token()}`)
        .send({ query: "standards" })
        .expect(201);

      expect(mockPrisma.queryLog.create).toHaveBeenCalledTimes(1);
      const { data } = mockPrisma.queryLog.create.mock.calls[0]![0];
      expect(data).toMatchObject({
        userId: "user_123",
        organizationId: "org_456",
        departmentId: "dept_789",
        query: "standards",
        policyDecision: expect.objectContaining({ decision: "allow" }),
        contextBundle: {
          citations: [
            {
              chunkId: "chunk-1",
              documentId: "doc-1",
              sourceId: "source-allowed",
              score: 0.9,
            },
          ],
        },
      });
      expect(data.latencyMs).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(data)).not.toContain("Coding standards text");
    });

    it("appends a QueryLog entry for a denied query", async () => {
      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce({
        departmentId: "dept_789",
        isPrimary: true,
      });
      mockPrisma.policy.findFirst.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token()}`)
        .send({ query: "secret" })
        .expect(201);

      expect(response.body.policy.decision).toBe("deny");
      expect(mockPrisma.queryLog.create).toHaveBeenCalledTimes(1);
      const { data } = mockPrisma.queryLog.create.mock.calls[0]![0];
      expect(data).toMatchObject({
        organizationId: "org_456",
        departmentId: "dept_789",
        policyDecision: expect.objectContaining({
          decision: "deny",
          reasonCode: "POLICY_NO_ACTIVE_POLICY",
        }),
        contextBundle: { citations: [] },
      });
    });

    it("does not write a QueryLog entry for an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post("/mcp")
        .send({ query: "test" })
        .expect(401);

      expect(mockPrisma.queryLog.create).not.toHaveBeenCalled();
    });

    it("fails the request when the audit write fails", async () => {
      mockPrisma.userDepartment.findFirst.mockResolvedValueOnce(null);
      mockPrisma.queryLog.create.mockRejectedValueOnce(new Error("db down"));

      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${token()}`)
        .send({ query: "test" })
        .expect(500);
    });
  });

  describe("auth rejection", () => {
    it("returns 401 when Authorization header is missing", async () => {
      await request(app.getHttpServer())
        .post("/mcp")
        .send({ query: "test" })
        .expect(401);
    });

    it("returns 401 when Bearer token value is invalid", async () => {
      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", "Bearer not.a.valid.jwt")
        .send({ query: "test" })
        .expect(401);
    });

    it("returns 401 when token is signed with wrong secret", async () => {
      const wrongSecretToken = jwt.sign(
        {
          sub: "user_123",
          email: "alice@example.com",
          organizationId: "org_456",
          role: "member",
        },
        "wrong-secret",
        { expiresIn: "1h" },
      );

      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${wrongSecretToken}`)
        .send({ query: "test" })
        .expect(401);
    });

    it("returns 401 when token is expired", async () => {
      const expiredToken = issueToken(
        {
          sub: "user_123",
          email: "alice@example.com",
          organizationId: "org_456",
          role: "member",
        },
        { expiresIn: "-1s" },
      );

      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({ query: "test" })
        .expect(401);
    });

    it("returns 401 for a malformed Authorization header (no Bearer prefix)", async () => {
      await request(app.getHttpServer())
        .post("/mcp")
        .set("Authorization", "justtoken")
        .send({ query: "test" })
        .expect(401);
    });

    it("does not call IdentityService when auth fails", async () => {
      await request(app.getHttpServer())
        .post("/mcp")
        .send({ query: "test" })
        .expect(401);

      expect(mockPrisma.userDepartment.findFirst).not.toHaveBeenCalled();
    });
  });
});
