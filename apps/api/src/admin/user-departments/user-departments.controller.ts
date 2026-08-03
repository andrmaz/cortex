import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { UserDepartmentService } from "./user-department.service";
import type { UserDepartmentWithDepartment } from "./user-department.service";
import type {
  AssignUserDepartmentsDto,
  UserDepartmentsResponseDto,
} from "./user-department.dto";
import type { AuthenticatedUser } from "../../auth/auth.types";

interface RequestWithUser {
  user: AuthenticatedUser;
}

function toResponseDto(
  userId: string,
  rows: UserDepartmentWithDepartment[],
): UserDepartmentsResponseDto {
  return {
    userId,
    departments: rows.map((row) => ({
      departmentId: row.departmentId,
      name: row.department.name,
      isPrimary: row.isPrimary,
    })),
  };
}

@Controller("api/admin/users/:userId/departments")
@UseGuards(AdminRoleGuard)
export class UserDepartmentsController {
  constructor(private readonly userDepartmentService: UserDepartmentService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findForUser(
    @Req() req: RequestWithUser,
    @Param("userId") userId: string,
  ): Promise<UserDepartmentsResponseDto> {
    const rows = await this.userDepartmentService.findForUser(
      userId,
      req.user.organizationId,
    );
    return toResponseDto(userId, rows);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async assign(
    @Req() req: RequestWithUser,
    @Param("userId") userId: string,
    @Body() body: AssignUserDepartmentsDto,
  ): Promise<UserDepartmentsResponseDto> {
    if (!Array.isArray(body.departmentIds) || body.departmentIds.length === 0) {
      throw new BadRequestException("departmentIds must be a non-empty array");
    }
    if (
      body.departmentIds.some((id) => typeof id !== "string" || id.length === 0)
    ) {
      throw new BadRequestException(
        "departmentIds must contain only non-empty strings",
      );
    }
    if (
      body.primaryDepartmentId !== undefined &&
      typeof body.primaryDepartmentId !== "string"
    ) {
      throw new BadRequestException("primaryDepartmentId must be a string");
    }

    const rows = await this.userDepartmentService.assign(
      userId,
      req.user.organizationId,
      body,
    );
    return toResponseDto(userId, rows);
  }
}
