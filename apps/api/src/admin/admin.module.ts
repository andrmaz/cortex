import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationService } from "./organizations/organization.service";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentService } from "./departments/department.service";
import { AdminUsersController } from "./users/admin-users.controller";
import { AdminUserService } from "./users/admin-user.service";
import { UserDepartmentsController } from "./user-departments/user-departments.controller";
import { UserDepartmentService } from "./user-departments/user-department.service";
import { SourcesController } from "./sources/sources.controller";
import { SourceService } from "./sources/source.service";
import { PoliciesController } from "./policies/policies.controller";
import { PolicyService } from "./policies/policy.service";

@Module({
  imports: [PrismaModule, IngestionModule],
  controllers: [
    OrganizationsController,
    DepartmentsController,
    AdminUsersController,
    UserDepartmentsController,
    SourcesController,
    PoliciesController,
  ],
  providers: [
    OrganizationService,
    DepartmentService,
    AdminUserService,
    UserDepartmentService,
    SourceService,
    PolicyService,
  ],
})
export class AdminModule {}
