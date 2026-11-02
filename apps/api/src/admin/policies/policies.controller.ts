import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Policy } from "db/client";
import type { AuthenticatedUser } from "../../auth/auth.types";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { PolicyService } from "./policy.service";
import type { PolicyResponseDto, PolicyRulesJson } from "./policy.dto";

interface RequestWithUser {
  user: AuthenticatedUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRulesJson(value: unknown): PolicyRulesJson {
  if (!isRecord(value) || Object.keys(value).length !== 1) {
    throw new BadRequestException(
      'rulesJson must be an object with only a "rules" array',
    );
  }

  const rules = value["rules"];
  if (
    !Array.isArray(rules) ||
    !rules.every((rule) => typeof rule === "string")
  ) {
    throw new BadRequestException(
      "rulesJson.rules must be an array of strings",
    );
  }

  return { rules };
}

function toResponseDto(policy: Policy): PolicyResponseDto {
  return {
    id: policy.id,
    version: policy.version,
    rulesJson: policy.rulesJson,
    isActive: policy.isActive,
    organizationId: policy.organizationId,
    departmentId: policy.departmentId,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

@Controller("api/admin/policies")
@UseGuards(AdminRoleGuard)
export class PoliciesController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: RequestWithUser,
    @Query("departmentId") departmentId: string | undefined,
  ): Promise<PolicyResponseDto[]> {
    if (!departmentId) {
      throw new BadRequestException("departmentId is required");
    }
    const policies = await this.policyService.findAllByDepartment(
      req.user.organizationId,
      departmentId,
    );
    return policies.map(toResponseDto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: RequestWithUser,
    @Body() body: unknown,
  ): Promise<PolicyResponseDto> {
    if (!isRecord(body)) {
      throw new BadRequestException("request body must be an object");
    }
    const departmentId = body["departmentId"];
    if (typeof departmentId !== "string" || !departmentId.trim()) {
      throw new BadRequestException(
        "departmentId is required and must be a string",
      );
    }

    const policy = await this.policyService.createVersion(
      req.user.organizationId,
      departmentId,
      parseRulesJson(body["rulesJson"]),
    );
    return toResponseDto(policy);
  }

  @Post(":policyId/activate")
  @HttpCode(HttpStatus.OK)
  async activate(
    @Req() req: RequestWithUser,
    @Param("policyId") policyId: string,
  ): Promise<PolicyResponseDto> {
    return toResponseDto(
      await this.policyService.activate(req.user.organizationId, policyId),
    );
  }

  @Post(":policyId/deactivate")
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Req() req: RequestWithUser,
    @Param("policyId") policyId: string,
  ): Promise<PolicyResponseDto> {
    return toResponseDto(
      await this.policyService.deactivate(req.user.organizationId, policyId),
    );
  }
}
