import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AdminModule } from "../admin.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-admin-integration";

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

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn() },
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

function issueToken(
  role: string,
  sub = "user-1",
  organizationId = "org-1",
): string {
  return jwt.sign(
    { sub, email: `${sub}@example.com`, organizationId, role },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

describe("Admin Organizations Integration", () => {
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

  // ---------------------------------------------------------------------------
  // Auth / role / org-isolation enforcement
  // ---------------------------------------------------------------------------

  describe("authorization", () => {
    it("returns 401 when no token is provided", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/organizations")
        .expect(401);
    });

    it("returns 401 when token is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/organizations")
        .set("Authorization", "Bearer not.a.jwt")
        .expect(401);
    });

    it("returns 403 when authenticated user has member role", async () => {
      const token = issueToken("member");

      await request(app.getHttpServer())
        .get("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("returns 403 on POST for non-admin role", async () => {
      const token = issueToken("member");

      await request(app.getHttpServer())
        .post("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "test.com" })
        .expect(403);
    });

    it("returns 403 when an admin requests another organization's details by id", async () => {
      const token = issueToken("admin", "user-1", "org-1");

      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-2")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    });

    it("returns 403 when an admin attempts to update another organization", async () => {
      const token = issueToken("admin", "user-1", "org-1");

      await request(app.getHttpServer())
        .patch("/api/admin/organizations/org-2")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "renamed.com" })
        .expect(403);

      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // List (read) — always scoped to the caller's own organization
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/organizations", () => {
    it("returns 200 with only the caller's own organization", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const res = await request(app.getHttpServer())
        .get("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: mockOrg.id,
        name: mockOrg.name,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-1" },
      });
    });

    it("never returns another organization's data regardless of what exists in the database", async () => {
      // Even if the caller's own org lookup resolves to a *different*
      // record than the one they belong to (e.g. a data bug), the response
      // only ever reflects whatever `findOne(callerOrgId)` returns — there
      // is no code path that can return more than one organization.
      const token = issueToken("admin", "user-1", "org-1");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      await request(app.getHttpServer())
        .get("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-1" },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Get by ID (read)
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/organizations/:id", () => {
    it("returns 200 with org details when the id matches the caller's own organization", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const res = await request(app.getHttpServer())
        .get(`/api/admin/organizations/${mockOrg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: mockOrg.id,
        name: mockOrg.name,
      });
    });

    it("returns 404 when organization does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/admin/organizations/${mockOrg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // Create (write) — not scoped to an existing org; new-tenant onboarding
  // ---------------------------------------------------------------------------

  describe("POST /api/admin/organizations", () => {
    it("returns 201 with new org on valid payload", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const res = await request(app.getHttpServer())
        .post("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "acme.com" })
        .expect(201);

      expect(res.body).toMatchObject({
        id: mockOrg.id,
        name: mockOrg.name,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it("returns 400 when name is missing", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .post("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it("returns 400 when name is an empty string", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .post("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "   " })
        .expect(400);
    });

    it("returns 409 when name already exists", async () => {
      const token = issueToken("admin");
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.organization.create.mockRejectedValue(p2002);

      await request(app.getHttpServer())
        .post("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "acme.com" })
        .expect(409);
    });

    it("trims whitespace from name before saving", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      await request(app.getHttpServer())
        .post("/api/admin/organizations")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "  acme.com  " })
        .expect(201);

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: { name: "acme.com" },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Update (write)
  // ---------------------------------------------------------------------------

  describe("PATCH /api/admin/organizations/:id", () => {
    it("returns 200 with updated org when the id matches the caller's own organization", async () => {
      const token = issueToken("admin");
      const updated = { ...mockOrg, name: "updated.com" };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.organization.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/api/admin/organizations/${mockOrg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "updated.com" })
        .expect(200);

      expect(res.body.name).toBe("updated.com");
    });

    it("returns 404 when organization does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/api/admin/organizations/${mockOrg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "new.com" })
        .expect(404);
    });

    it("returns 409 when new name conflicts with an existing org", async () => {
      const token = issueToken("admin");
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.organization.update.mockRejectedValue(p2002);

      await request(app.getHttpServer())
        .patch(`/api/admin/organizations/${mockOrg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "other.com" })
        .expect(409);
    });
  });
});
