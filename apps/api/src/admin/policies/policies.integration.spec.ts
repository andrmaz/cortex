import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AdminModule } from "../admin.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-policies-integration";
const now = new Date("2024-06-01T12:00:00Z");

class MockGoogleStrategy {
  name = "google";
}

const mockPolicy = {
  id: "policy-1",
  version: 1,
  rulesJson: { rules: ["Use TypeScript"] },
  isActive: false,
  organizationId: "org-1",
  departmentId: "dept-1",
  createdAt: now,
  updatedAt: now,
};

const transactionClient = {
  policy: {
    updateMany: vi.fn(),
    update: vi.fn(),
  },
};

const mockPrisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  department: { findFirst: vi.fn() },
  policy: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

function issueToken(role: string, sub = "user-1"): string {
  return jwt.sign(
    { sub, email: `${sub}@example.com`, organizationId: "org-1", role },
    TEST_JWT_SECRET,
    { expiresIn: "1h" },
  );
}

describe("Admin Policies Integration", () => {
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
    vi.clearAllMocks();
    mockPrisma.department.findFirst.mockResolvedValue({
      id: "dept-1",
      organizationId: "org-1",
    });
  });

  it("requires authentication and the admin role", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/policies?departmentId=dept-1")
      .expect(401);

    await request(app.getHttpServer())
      .get("/api/admin/policies?departmentId=dept-1")
      .set("Authorization", `Bearer ${issueToken("member")}`)
      .expect(403);
  });

  it("rejects malformed policy JSON before persistence", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/policies")
      .set("Authorization", `Bearer ${issueToken("admin")}`)
      .send({ departmentId: "dept-1", rulesJson: { rules: "not-an-array" } })
      .expect(400);

    expect(mockPrisma.policy.create).not.toHaveBeenCalled();
  });

  it("creates a valid inactive policy version scoped to the admin organization", async () => {
    mockPrisma.policy.findFirst.mockResolvedValue(null);
    mockPrisma.policy.create.mockResolvedValue(mockPolicy);

    const response = await request(app.getHttpServer())
      .post("/api/admin/policies")
      .set("Authorization", `Bearer ${issueToken("admin")}`)
      .send({
        departmentId: "dept-1",
        rulesJson: { rules: ["Use TypeScript"] },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: mockPolicy.id,
      version: 1,
      isActive: false,
      departmentId: "dept-1",
    });
    expect(mockPrisma.policy.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        departmentId: "dept-1",
        version: 1,
        rulesJson: { rules: ["Use TypeScript"] },
        isActive: false,
      },
    });
  });

  it("rejects a department that does not belong to the admin organization", async () => {
    mockPrisma.department.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post("/api/admin/policies")
      .set("Authorization", `Bearer ${issueToken("admin")}`)
      .send({ departmentId: "dept-2", rulesJson: { rules: [] } })
      .expect(404);

    expect(mockPrisma.policy.create).not.toHaveBeenCalled();
  });

  it("lists policies for the selected department", async () => {
    mockPrisma.policy.findMany.mockResolvedValue([mockPolicy]);

    const response = await request(app.getHttpServer())
      .get("/api/admin/policies?departmentId=dept-1")
      .set("Authorization", `Bearer ${issueToken("admin")}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(mockPrisma.policy.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", departmentId: "dept-1" },
      orderBy: { version: "desc" },
    });
  });

  it("atomically activates a policy version", async () => {
    mockPrisma.policy.findFirst.mockResolvedValue(mockPolicy);
    transactionClient.policy.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.policy.update.mockResolvedValue({
      ...mockPolicy,
      isActive: true,
    });
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    await request(app.getHttpServer())
      .post("/api/admin/policies/policy-1/activate")
      .set("Authorization", `Bearer ${issueToken("admin")}`)
      .expect(200)
      .expect(({ body }) => expect(body.isActive).toBe(true));

    expect(transactionClient.policy.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        departmentId: "dept-1",
        isActive: true,
      },
      data: { isActive: false },
    });
  });
});
