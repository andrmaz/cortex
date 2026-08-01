import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { DepartmentService } from "./department.service";
import type {
  CreateDepartmentDto,
  DepartmentResponseDto,
} from "./department.dto";
import type { Department } from "db/client";

function toResponseDto(dept: Department): DepartmentResponseDto {
  return {
    id: dept.id,
    name: dept.name,
    organizationId: dept.organizationId,
    createdAt: dept.createdAt.toISOString(),
    updatedAt: dept.updatedAt.toISOString(),
  };
}

@Controller("api/admin/organizations/:organizationId/departments")
@UseGuards(AdminRoleGuard)
export class DepartmentsController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Param("organizationId") organizationId: string,
  ): Promise<DepartmentResponseDto[]> {
    const departments =
      await this.departmentService.findAllByOrganization(organizationId);
    return departments.map(toResponseDto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      throw new BadRequestException("name is required and must be a string");
    }
    const dept = await this.departmentService.create(organizationId, {
      name: body.name.trim(),
    });
    return toResponseDto(dept);
  }
}
