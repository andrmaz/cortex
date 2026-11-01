import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth.types";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { PolicyService } from "./policy.service";
import type { Policy } from "db/client";
import type { PolicyResponseDto } from "./policy.dto";

interface AdminRequest {
  user: AuthenticatedUser;
}

function response(policy: Policy): PolicyResponseDto {
  return {
    ...policy,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

function payload(input: unknown, fields: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("Body must be an object");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !fields.includes(key)))
    throw new BadRequestException("Unknown request field");
  return body;
}

@Controller("api/admin/policies")
@UseGuards(AdminRoleGuard)
export class PoliciesController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  async list(@Req() req: AdminRequest): Promise<PolicyResponseDto[]> {
    return (await this.policies.list(req.user.organizationId)).map(response);
  }

  @Get(":id")
  async find(
    @Req() req: AdminRequest,
    @Param("id") id: string,
  ): Promise<PolicyResponseDto> {
    return response(await this.policies.find(req.user.organizationId, id));
  }

  @Post()
  async create(
    @Req() req: AdminRequest,
    @Body() input: unknown,
  ): Promise<PolicyResponseDto> {
    const body = payload(input, ["departmentId", "rulesJson"]);
    if (typeof body.departmentId !== "string" || !body.departmentId.trim())
      throw new BadRequestException("departmentId is required");
    return response(
      await this.policies.create(
        req.user.organizationId,
        body.departmentId,
        body.rulesJson,
      ),
    );
  }

  @Patch(":id")
  async update(
    @Req() req: AdminRequest,
    @Param("id") id: string,
    @Body() input: unknown,
  ): Promise<PolicyResponseDto> {
    const body = payload(input, ["rulesJson"]);
    return response(
      await this.policies.update(req.user.organizationId, id, body.rulesJson),
    );
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @Req() req: AdminRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.policies.remove(req.user.organizationId, id);
  }

  @Post(":id/activate")
  @HttpCode(200)
  async activate(
    @Req() req: AdminRequest,
    @Param("id") id: string,
  ): Promise<PolicyResponseDto> {
    return response(
      await this.policies.setActive(req.user.organizationId, id, true),
    );
  }

  @Post(":id/deactivate")
  @HttpCode(200)
  async deactivate(
    @Req() req: AdminRequest,
    @Param("id") id: string,
  ): Promise<PolicyResponseDto> {
    return response(
      await this.policies.setActive(req.user.organizationId, id, false),
    );
  }
}
