import { Module } from "@nestjs/common";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MCPController],
  providers: [IdentityService],
})
export class MCPModule {}
