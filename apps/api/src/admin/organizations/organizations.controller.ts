import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { OrganizationService } from "./organization.service";
import type {
  CreateOrganizationDto,
  OrganizationResponseDto,
  UpdateOrganizationDto,
} from "./organization.dto";
import type { Organization } from "db/client";

function toResponseDto(org: Organization): OrganizationResponseDto {
  return {
    id: org.id,
    name: org.name,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

@Controller("api/admin/organizations")
@UseGuards(AdminRoleGuard)
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<OrganizationResponseDto[]> {
    const orgs = await this.organizationService.findAll();
    return orgs.map(toResponseDto);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string): Promise<OrganizationResponseDto> {
    const org = await this.organizationService.findOne(id);
    return toResponseDto(org);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      throw new BadRequestException("name is required and must be a string");
    }
    const org = await this.organizationService.create({
      name: body.name.trim(),
    });
    return toResponseDto(org);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    if (
      body.name !== undefined &&
      (typeof body.name !== "string" || !body.name.trim())
    ) {
      throw new BadRequestException("name must be a non-empty string");
    }
    const dto: UpdateOrganizationDto =
      body.name !== undefined ? { name: body.name.trim() } : {};
    const org = await this.organizationService.update(id, dto);
    return toResponseDto(org);
  }
}
