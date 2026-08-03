import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AdminModule } from "../admin.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-departments-integration";

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

const mockDept = {
  id: "dept-1",
  name: "Engineering",
  organizationId: "org-1",
  createdAt: now,
  updatedAt: now,
};

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  department: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

function issueToken(role: string, sub = "user-1"): string {
  return jwt.sign(
    { sub, email: `${sub}@example.com`, organizationId: "org-1", role },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

describe("Admin Departments Integration", () => {
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
        .get("/api/admin/organizations/org-1/departments")
        .expect(401);
    });

    it("returns 401 when the token is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/departments")
        .set("Authorization", "Bearer not.a.jwt")
        .expect(401);
    });

    it("returns 403 when authenticated user has member role", async () => {
      const token = issueToken("member");

      await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("returns 403 on POST for non-admin role", async () => {
      const token = issueToken("member");

      await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Engineering" })
        .expect(403);
    });
  });

  describe("GET /api/admin/organizations/:organizationId/departments", () => {
    it("returns 200 with department list scoped to the organization", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.department.findMany.mockResolvedValue([mockDept]);

      const res = await request(app.getHttpServer())
        .get("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: mockDept.id,
        name: mockDept.name,
        organizationId: mockDept.organizationId,
      });
      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns 404 when the organization does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get("/api/admin/organizations/missing-org/departments")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });

  describe("POST /api/admin/organizations/:organizationId/departments", () => {
    it("returns 201 with the new department on valid payload", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.department.create.mockResolvedValue(mockDept);

      const res = await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Engineering" })
        .expect(201);

      expect(res.body).toMatchObject({
        id: mockDept.id,
        name: "Engineering",
        organizationId: "org-1",
      });
    });

    it("returns 400 when name is missing", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it("returns 400 when name is an empty/whitespace-only string", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "   " })
        .expect(400);

      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });

    it("returns 400 when name is not a string", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: 12345 })
        .expect(400);

      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });

    it("returns 404 when the organization does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post("/api/admin/organizations/missing-org/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Engineering" })
        .expect(404);
    });

    it("returns 409 when the department name already exists in the organization", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.department.create.mockRejectedValue(p2002);

      await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Engineering" })
        .expect(409);
    });

    it("trims whitespace from name before saving", async () => {
      const token = issueToken("admin");
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.department.create.mockResolvedValue(mockDept);

      await request(app.getHttpServer())
        .post("/api/admin/organizations/org-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "  Engineering  " })
        .expect(201);

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: { name: "Engineering", organizationId: "org-1" },
      });
    });
  });
});
