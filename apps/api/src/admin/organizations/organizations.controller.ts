import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { assertAdminOrganizationAccess } from "../guards/assert-admin-organization";
import { OrganizationService } from "./organization.service";
import type {
  CreateOrganizationDto,
  OrganizationResponseDto,
  UpdateOrganizationDto,
} from "./organization.dto";
import type { Organization } from "db/client";
import type { AuthenticatedUser } from "../../auth/auth.types";

interface RequestWithUser {
  user: AuthenticatedUser;
}

function toResponseDto(org: Organization): OrganizationResponseDto {
  return {
    id: org.id,
    name: org.name,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

/**
 * Organization membership is the tenant boundary itself, so every route
 * here is scoped to the authenticated admin's own organization —
 * `assertAdminOrganizationAccess` blocks any attempt to read or modify a
 * different organization with 403 Forbidden, mirroring the same convention
 * used by `DepartmentsController` and `AdminUsersController`. Creating a new
 * organization is the one exception: it doesn't read or modify existing
 * tenant data, so it isn't scoped to an existing org.
 */
@Controller("api/admin/organizations")
@UseGuards(AdminRoleGuard)
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * Returns the caller's own organization as a single-item list. There is
   * no cross-tenant "list all organizations" view — an admin can only ever
   * see the organization they belong to.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: RequestWithUser,
  ): Promise<OrganizationResponseDto[]> {
    const org = await this.organizationService.findOne(req.user.organizationId);
    return [toResponseDto(org)];
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
  ): Promise<OrganizationResponseDto> {
    assertAdminOrganizationAccess(req.user.organizationId, id);
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
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    assertAdminOrganizationAccess(req.user.organizationId, id);
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
