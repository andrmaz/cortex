import { Test } from "@nestjs/testing";
import { MCPModule } from "./mcp.module";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleStrategy } from "../auth/strategies/google.strategy";

/** Stub so tests don't require real OAuth credentials. */
class MockGoogleStrategy {
  name = "google";
}

/** Stub so tests don't require a real database connection. */
const mockPrismaService = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  userDepartment: { findFirst: jest.fn() },
};

describe("MCPModule", () => {
  let previousJwtSecret: string | undefined;

  beforeAll(() => {
    previousJwtSecret = process.env["JWT_SECRET"];
    // JwtStrategy and JwtModule.registerAsync require JWT_SECRET at startup.
    process.env["JWT_SECRET"] = "test-secret-for-mcp-module-spec";
  });

  afterAll(() => {
    if (previousJwtSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = previousJwtSecret;
    }
  });

  it("should be defined and compile successfully", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    expect(module).toBeDefined();
  });

  it("should not throw when creating the module", async () => {
    await expect(
      Test.createTestingModule({
        imports: [MCPModule],
      })
        .overrideProvider(GoogleStrategy)
        .useClass(MockGoogleStrategy)
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile(),
    ).resolves.toBeDefined();
  });

  it("should provide MCPController", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    const controller = module.get(MCPController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(MCPController);
  });

  it("should provide IdentityService", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    const service = module.get(IdentityService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(IdentityService);
  });

  it("should expose MCPController handleMCP method via module", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    const controller = module.get(MCPController);
    expect(typeof controller.handleMCP).toBe("function");
  });
});
