import { Module } from "@nestjs/common";
import { MCPController } from "./mcp.controller";

@Module({
  controllers: [MCPController],
})
export class MCPModule {}
