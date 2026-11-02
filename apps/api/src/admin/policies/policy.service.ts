import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Policy } from "db";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors";
import { PrismaService } from "../../prisma/prisma.service";
import type { PolicyRulesJson } from "./policy.dto";

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByDepartment(
    organizationId: string,
    departmentId: string,
  ): Promise<Policy[]> {
    await this.ensureDepartmentExists(organizationId, departmentId);
    return this.prisma.policy.findMany({
      where: { organizationId, departmentId },
      orderBy: { version: "desc" },
    });
  }

  async createVersion(
    organizationId: string,
    departmentId: string,
    rulesJson: PolicyRulesJson,
  ): Promise<Policy> {
    await this.ensureDepartmentExists(organizationId, departmentId);

    const latestPolicy = await this.prisma.policy.findFirst({
      where: { organizationId, departmentId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    try {
      return await this.prisma.policy.create({
        data: {
          organizationId,
          departmentId,
          version: (latestPolicy?.version ?? 0) + 1,
          rulesJson: { rules: [...rulesJson.rules] },
          isActive: false,
        },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException(
          "A policy version was created concurrently. Refresh and retry.",
        );
      }
      throw error;
    }
  }

  async activate(organizationId: string, policyId: string): Promise<Policy> {
    const target = await this.findPolicy(organizationId, policyId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.policy.updateMany({
          where: {
            organizationId,
            departmentId: target.departmentId,
            isActive: true,
          },
          data: { isActive: false },
        });

        return tx.policy.update({
          where: { id: policyId },
          data: { isActive: true },
        });
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException(
          "The active policy changed concurrently. Refresh and retry.",
        );
      }
      throw error;
    }
  }

  async deactivate(organizationId: string, policyId: string): Promise<Policy> {
    await this.findPolicy(organizationId, policyId);
    return this.prisma.policy.update({
      where: { id: policyId },
      data: { isActive: false },
    });
  }

  private async findPolicy(
    organizationId: string,
    policyId: string,
  ): Promise<Policy> {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, organizationId },
    });
    if (!policy) {
      throw new NotFoundException(`Policy with id "${policyId}" not found`);
    }
    return policy;
  }

  private async ensureDepartmentExists(
    organizationId: string,
    departmentId: string,
  ): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId },
    });
    if (!department) {
      throw new NotFoundException(
        `Department with id "${departmentId}" not found`,
      );
    }
  }
}
