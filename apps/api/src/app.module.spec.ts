import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { MCPController } from "./mcp/mcp.controller";
import { GoogleStrategy } from "./auth/strategies/google.strategy";
import { PrismaService } from "./prisma/prisma.service";

/** Stub that replaces GoogleStrategy so tests don't need real OAuth credentials. */
class MockGoogleStrategy {
  name = "google";
}

/** Stub that replaces PrismaService so tests don't need a real database. */
class MockPrismaService {
  $connect = jest.fn().mockResolvedValue(undefined);
  $disconnect = jest.fn().mockResolvedValue(undefined);
  user = { findUnique: jest.fn(), create: jest.fn() };
  organization = { findFirst: jest.fn() };
}

describe("AppModule", () => {
  beforeAll(() => {
    // AuthModule.registerAsync and JwtStrategy both require JWT_SECRET at startup.
    process.env["JWT_SECRET"] = "test-secret-for-app-module-spec";
  });

  afterAll(() => {
    delete process.env["JWT_SECRET"];
  });

  it("should be defined and compile successfully", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useClass(MockPrismaService)
      .compile();

    expect(module).toBeDefined();
  });

  it("should not throw when creating the application module", async () => {
    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(GoogleStrategy)
        .useClass(MockGoogleStrategy)
        .overrideProvider(PrismaService)
        .useClass(MockPrismaService)
        .compile(),
    ).resolves.not.toThrow();
  });

  it("should provide MCPController via imported MCPModule", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useClass(MockPrismaService)
      .compile();

    const controller = module.get(MCPController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(MCPController);
  });

  it("should wire MCPController so handleMCP is callable", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useClass(MockPrismaService)
      .compile();

    const controller = module.get(MCPController);
    const response = await controller.handleMCP({
      userId: "test_user",
      organizationId: "test_org",
      departmentId: "test_dept",
      query: "integration check",
    });

    expect(response.answer).toBe(
      "Based on company standards: integration check",
    );
  });
});
