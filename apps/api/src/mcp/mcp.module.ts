import { Module } from "@nestjs/common";
import { MCPController } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { ContextBundleService } from "./context-bundle.service";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RetrievalModule } from "../retrieval/retrieval.module";

@Module({
  imports: [AuthModule, PrismaModule, RetrievalModule],
  controllers: [MCPController],
  providers: [IdentityService, ContextBundleService],
})
export class MCPModule {}
