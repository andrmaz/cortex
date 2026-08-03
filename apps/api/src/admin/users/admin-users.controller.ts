import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { assertAdminOrganizationAccess } from "../guards/assert-admin-organization";
import { AdminUserService } from "./admin-user.service";
import type { AdminUserResponseDto } from "./user.dto";
import type { User } from "db/client";
import type { AuthenticatedUser } from "../../auth/auth.types";

interface RequestWithUser {
  user: AuthenticatedUser;
}

function toResponseDto(user: User): AdminUserResponseDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt.toISOString(),
  };
}

@Controller("api/admin/organizations/:organizationId/users")
@UseGuards(AdminRoleGuard)
export class AdminUsersController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: RequestWithUser,
    @Param("organizationId") organizationId: string,
  ): Promise<AdminUserResponseDto[]> {
    assertAdminOrganizationAccess(req.user.organizationId, organizationId);
    const users =
      await this.adminUserService.findAllByOrganization(organizationId);
    return users.map(toResponseDto);
  }
}
