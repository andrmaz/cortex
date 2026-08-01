import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { AdminUserService } from "./admin-user.service";
import type { AdminUserResponseDto } from "./user.dto";
import type { User } from "db/client";

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
    @Param("organizationId") organizationId: string,
  ): Promise<AdminUserResponseDto[]> {
    const users =
      await this.adminUserService.findAllByOrganization(organizationId);
    return users.map(toResponseDto);
  }
}
