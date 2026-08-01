import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationService } from "./organizations/organization.service";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentService } from "./departments/department.service";
import { AdminUsersController } from "./users/admin-users.controller";
import { AdminUserService } from "./users/admin-user.service";
import { UserDepartmentsController } from "./user-departments/user-departments.controller";
import { UserDepartmentService } from "./user-departments/user-department.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    OrganizationsController,
    DepartmentsController,
    AdminUsersController,
    UserDepartmentsController,
  ],
  providers: [
    OrganizationService,
    DepartmentService,
    AdminUserService,
    UserDepartmentService,
  ],
})
export class AdminModule {}
