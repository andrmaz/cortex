import { Module } from "@nestjs/common";
import { MCPModule } from "./mcp/mcp.module";

@Module({
  imports: [MCPModule],
})
export class AppModule {}
