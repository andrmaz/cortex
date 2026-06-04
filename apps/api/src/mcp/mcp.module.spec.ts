import { Test } from "@nestjs/testing";
import { MCPModule } from "./mcp.module";
import { MCPController } from "./mcp.controller";

describe("MCPModule", () => {
  it("should be defined and compile successfully", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it("should provide MCPController", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    }).compile();

    const controller = module.get(MCPController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(MCPController);
  });

  it("should not throw when creating the module", async () => {
    await expect(
      Test.createTestingModule({
        imports: [MCPModule],
      }).compile()
    ).resolves.not.toThrow();
  });

  it("should expose MCPController handleMCP method via module", async () => {
    const module = await Test.createTestingModule({
      imports: [MCPModule],
    }).compile();

    const controller = module.get(MCPController);
    expect(typeof controller.handleMCP).toBe("function");
  });
});