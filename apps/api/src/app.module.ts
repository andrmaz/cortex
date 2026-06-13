import { Module } from "@nestjs/common";
import { MCPModule } from "./mcp/mcp.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuthModule, MCPModule],
})
export class AppModule {}
