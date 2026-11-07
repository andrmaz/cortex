import { Module } from "@nestjs/common";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { ContextBundleService } from "./context-bundle.service";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [AuthModule, PrismaModule, PolicyModule],
  controllers: [MCPController],
  providers: [IdentityService, ContextBundleService],
})
export class MCPModule {}
