import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AdminModule } from "../admin.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-user-departments-integration";

class MockGoogleStrategy {
  name = "google";
}

const mockUser = {
  id: "user-1",
  email: "alice@acme.com",
  googleSub: "google-sub-1",
  role: "member",
  organizationId: "org-1",
};

const mockAssignmentRows = [
  {
    departmentId: "dept-1",
    isPrimary: true,
    department: { name: "Engineering" },
  },
];

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  user: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  department: { findMany: jest.fn() },
  userDepartment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
};

function issueToken(role: string, sub = "admin-user"): string {
  return jwt.sign(
    { sub, email: `${sub}@example.com`, organizationId: "org-1", role },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

describe("Admin UserDepartments Integration", () => {
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
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) =>
      Promise.all(ops),
    );
  });

  describe("authorization", () => {
    it("returns 401 when no token is provided", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/users/user-1/departments")
        .expect(401);
    });

    it("returns 401 when the token is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/admin/users/user-1/departments")
        .set("Authorization", "Bearer not.a.jwt")
        .expect(401);
    });

    it("returns 403 when authenticated user has member role", async () => {
      const token = issueToken("member");

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-1"] })
        .expect(403);
    });
  });

  describe("GET /api/admin/users/:userId/departments", () => {
    it("returns 200 with the user's department assignments", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userDepartment.findMany.mockResolvedValue(mockAssignmentRows);

      const res = await request(app.getHttpServer())
        .get("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        userId: "user-1",
        departments: [
          { departmentId: "dept-1", name: "Engineering", isPrimary: true },
        ],
      });
    });

    it("returns 404 when the user does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get("/api/admin/users/missing-user/departments")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });
  });

  describe("PUT /api/admin/users/:userId/departments", () => {
    it("returns 200 with the updated assignment set on a valid payload", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);
      mockPrisma.userDepartment.findFirst.mockResolvedValue(null);
      mockPrisma.userDepartment.findMany.mockResolvedValue(mockAssignmentRows);

      const res = await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-1"] })
        .expect(200);

      expect(res.body).toEqual({
        userId: "user-1",
        departments: [
          { departmentId: "dept-1", name: "Engineering", isPrimary: true },
        ],
      });
    });

    it("returns 400 when departmentIds is missing", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it("returns 400 when departmentIds is an empty array", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: [] })
        .expect(400);
    });

    it("returns 404 when the user does not exist", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put("/api/admin/users/missing-user/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-1"] })
        .expect(404);
    });

    it("returns 400 when a departmentId is outside the user's organization", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.department.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-from-other-org"] })
        .expect(400);
    });

    it("returns 400 when departmentIds is not an array", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: "dept-1" })
        .expect(400);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns 400 when departmentIds contains non-string elements", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: [123] })
        .expect(400);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns 403 when the target user belongs to another organization", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organizationId: "org-2",
      });

      await request(app.getHttpServer())
        .get("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("returns 400 when primaryDepartmentId is not a string", async () => {
      const token = issueToken("admin");

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-1"], primaryDepartmentId: 42 })
        .expect(400);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns 400 when primaryDepartmentId is not included in departmentIds", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-1"], primaryDepartmentId: "dept-2" })
        .expect(400);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("deduplicates repeated departmentIds and returns 200", async () => {
      const token = issueToken("admin");
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);
      mockPrisma.userDepartment.findFirst.mockResolvedValue(null);
      mockPrisma.userDepartment.findMany.mockResolvedValue(mockAssignmentRows);

      await request(app.getHttpServer())
        .put("/api/admin/users/user-1/departments")
        .set("Authorization", `Bearer ${token}`)
        .send({ departmentIds: ["dept-1", "dept-1"] })
        .expect(200);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["dept-1"] }, organizationId: "org-1" },
        select: { id: true },
      });
    });
  });
});
