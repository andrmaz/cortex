import { Module } from "@nestjs/common";
import { MCPModule } from "./mcp/mcp.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AdminModule } from "./admin/admin.module";

@Module({
  imports: [PrismaModule, AuthModule, MCPModule, AdminModule],
})
export class AppModule {}
