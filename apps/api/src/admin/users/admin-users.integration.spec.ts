import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AdminModule } from "../admin.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-admin-users-integration";

class MockGoogleStrategy {
  name = "google";
}

const now = new Date("2024-06-01T12:00:00Z");

const mockOrg = {
  id: "org-1",
  name: "acme.com",
  createdAt: now,
  updatedAt: now,
};

const mockUser = {
  id: "user-1",
  email: "alice@acme.com",
  googleSub: "google-sub-1",
  role: "member",
  organizationId: "org-1",
  createdAt: now,
  updatedAt: now,
};

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  organization: { findUnique: jest.fn() },
};

function issueToken(role: string, sub = "admin-user"): string {
  return jwt.sign(
    { sub, email: `${sub}@example.com`, organizationId: "org-1", role },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

describe("Admin Users Integration", () => {
  let app: INestApplication;
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule, AuthModule],
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

  describe("authorization", () => {
    it("returns 401 when no token is provided", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .expect(401);
    });

    it("returns 401 when the token is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", "Bearer not.a.jwt")
        .expect(401);
    });

    it("returns 403 when authenticated user has member role", async () => {
      const token = issueToken("member");

      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("returns 403 when admin requests another organization's users", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-2/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/organizations/:organizationId/users", () => {
    it("returns 200 with the user list scoped to the organization", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const res = await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        organizationId: mockUser.organizationId,
        createdAt: now.toISOString(),
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { email: "asc" },
      });
    });

    it("omits internal fields (e.g. googleSub, updatedAt) from the response", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const res = await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body[0]).not.toHaveProperty("googleSub");
      expect(res.body[0]).not.toHaveProperty("updatedAt");
    });

    it("returns an empty array when the organization has no users", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it("returns 404 when the organization does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it("returns multiple users in the order provided by the service", async () => {
      const token = issueToken("admin");
      const secondUser = {
        ...mockUser,
        id: "user-2",
        email: "bob@acme.com",
      };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.user.findMany.mockResolvedValue([mockUser, secondUser]);

      const res = await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/users")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.map((u: { email: string }) => u.email)).toEqual([
        "alice@acme.com",
        "bob@acme.com",
      ]);
    });
  });
});