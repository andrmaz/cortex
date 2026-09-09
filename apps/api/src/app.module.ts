import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { MCPModule } from "./mcp/mcp.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AdminModule } from "./admin/admin.module";
import { OrgContextInterceptor } from "./common/org-context.interceptor";
import { OrgScopeExceptionFilter } from "./common/org-scope-exception.filter";

@Module({
  imports: [PrismaModule, AuthModule, MCPModule, AdminModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
    { provide: APP_FILTER, useClass: OrgScopeExceptionFilter },
  ],
})
export class AppModule {}
