import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { MCPController } from "./mcp/mcp.controller";

describe("AppModule", () => {
  it("should be defined and compile successfully", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it("should not throw when creating the application module", async () => {
    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      }).compile()
    ).resolves.not.toThrow();
  });

  it("should provide MCPController via imported MCPModule", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const controller = module.get(MCPController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(MCPController);
  });

  it("should wire MCPController so handleMCP is callable", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const controller = module.get(MCPController);
    const response = await controller.handleMCP({
      userId: "test_user",
      organizationId: "test_org",
      departmentId: "test_dept",
      query: "integration check",
    });

    expect(response.answer).toBe("Based on company standards: integration check");
  });
});