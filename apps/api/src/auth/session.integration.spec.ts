import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AuthModule } from "./auth.module";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleStrategy } from "./strategies/google.strategy";

const TEST_JWT_SECRET = "test-secret-for-session-integration";

class MockGoogleStrategy {
  name = "google";
}

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
  organization: { findUnique: jest.fn() },
  userDepartment: { findMany: jest.fn() },
};

function issueToken(payload: {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
}): string {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "1h" });
}

describe("Session Enrichment Integration (GET /api/me)", () => {
  let app: INestApplication;
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
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

  it("returns 401 when no token is provided", async () => {
    await request(app.getHttpServer()).get("/api/me").expect(401);
  });

  it("returns JWT claims enriched with departmentIds and primaryDepartmentId", async () => {
    const token = issueToken({
      sub: "user-1",
      email: "alice@acme.com",
      organizationId: "org-1",
      role: "member",
    });
    mockPrisma.userDepartment.findMany.mockResolvedValue([
      { departmentId: "dept-1", isPrimary: false },
      { departmentId: "dept-2", isPrimary: true },
    ]);

    const res = await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      id: "user-1",
      email: "alice@acme.com",
      organizationId: "org-1",
      role: "member",
      departmentIds: ["dept-1", "dept-2"],
      primaryDepartmentId: "dept-2",
    });
  });

  it("reflects a newly assigned department immediately, without reissuing the token", async () => {
    const token = issueToken({
      sub: "user-1",
      email: "alice@acme.com",
      organizationId: "org-1",
      role: "member",
    });

    mockPrisma.userDepartment.findMany.mockResolvedValueOnce([]);
    const before = await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(before.body.departmentIds).toEqual([]);
    expect(before.body.primaryDepartmentId).toBeNull();

    // Simulate an admin assigning the same user to a department in between
    // requests, using the exact same (already-issued) token.
    mockPrisma.userDepartment.findMany.mockResolvedValueOnce([
      { departmentId: "dept-new", isPrimary: true },
    ]);
    const after = await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(after.body.departmentIds).toEqual(["dept-new"]);
    expect(after.body.primaryDepartmentId).toBe("dept-new");
  });

  it("returns an empty departmentIds array and null primary for a user with no assignments", async () => {
    const token = issueToken({
      sub: "user-2",
      email: "bob@acme.com",
      organizationId: "org-1",
      role: "member",
    });
    mockPrisma.userDepartment.findMany.mockResolvedValue([]);

    const res = await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.departmentIds).toEqual([]);
    expect(res.body.primaryDepartmentId).toBeNull();
  });
});

describe("OAuth session exchange (POST /auth/session)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let previousJwtSecret: string | undefined;

  beforeAll(async () => {
    previousJwtSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    authService = moduleRef.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
    if (previousJwtSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = previousJwtSecret;
    }
  });

  it("exchanges a one-time code for the session JWT", async () => {
    const token = issueToken({
      sub: "user-1",
      email: "alice@acme.com",
      organizationId: "org-1",
      role: "member",
    });
    const code = authService.issueOneTimeCode(token);

    const res = await request(app.getHttpServer())
      .post("/auth/session")
      .send({ code })
      .expect(200);

    expect(res.body).toEqual({ accessToken: token });
  });

  it("rejects a reused one-time code", async () => {
    const token = issueToken({
      sub: "user-1",
      email: "alice@acme.com",
      organizationId: "org-1",
      role: "member",
    });
    const code = authService.issueOneTimeCode(token);

    await request(app.getHttpServer())
      .post("/auth/session")
      .send({ code })
      .expect(200);

    await request(app.getHttpServer())
      .post("/auth/session")
      .send({ code })
      .expect(401);
  });

  it("returns 400 when code is missing or not a string", async () => {
    await request(app.getHttpServer())
      .post("/auth/session")
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post("/auth/session")
      .send({ code: 123 })
      .expect(400);
  });
});
