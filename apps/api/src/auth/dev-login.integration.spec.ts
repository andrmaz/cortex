import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthModule } from "./auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleStrategy } from "./strategies/google.strategy";

class MockGoogleStrategy {
  name = "google";
}

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn() },
};

describe("GET /auth/dev-login", () => {
  let app: INestApplication;
  const saved = { ...process.env };

  beforeAll(async () => {
    process.env["JWT_SECRET"] = "test-secret-dev-login";
    process.env["CORTEX_WEB_URL"] = "http://web.test";
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] })
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
    process.env = saved;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env["CORTEX_DEV_LOGIN"] = "true";
    process.env["NODE_ENV"] = "test";
  });

  const get = (email = "qa-admin@fixture.test") =>
    request(app.getHttpServer()).get("/auth/dev-login").query({ email });

  it("returns 404 unless CORTEX_DEV_LOGIN=true", async () => {
    delete process.env["CORTEX_DEV_LOGIN"];
    await get().expect(404);
  });

  it("returns 404 in production even when enabled", async () => {
    process.env["NODE_ENV"] = "production";
    await get().expect(404);
  });

  it("redirects with an error for an unknown user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await get("nobody@fixture.test").expect(302);
    expect(res.headers["location"]).toBe(
      "http://web.test/auth/callback?error=authentication_failed",
    );
  });

  it("redirects with a one-time code that exchanges for a token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "qa-admin@fixture.test",
      organizationId: "o1",
      role: "admin",
    });
    const res = await get().expect(302);
    const code = new URL(res.headers["location"] as string).searchParams.get(
      "code",
    );
    expect(code).toBeTruthy();

    const exchange = await request(app.getHttpServer())
      .post("/auth/session")
      .send({ code })
      .expect(200);
    expect(exchange.body.accessToken).toEqual(expect.any(String));
  });
});
