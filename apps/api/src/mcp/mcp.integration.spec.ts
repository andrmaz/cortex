import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { MCPModule } from "./mcp.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleStrategy } from "../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-mcp-integration";

/** Stub so tests don't require real OAuth credentials. */
class MockGoogleStrategy {
  name = "google";
}

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  userDepartment: { findFirst: jest.fn() },
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
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
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
    jest.clearAllMocks();
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
        answer: "Based on company standards: What are the coding standards?",
      });
      expect(Array.isArray(response.body.context)).toBe(true);
      expect(Array.isArray(response.body.policy.rules)).toBe(true);
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
