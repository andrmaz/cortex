import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  parsePolicyDocument,
  type PolicyDocument,
} from "@cortex/shared/policy";
import type { Policy, Prisma } from "db/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<Policy[]> {
    return this.prisma.policy.findMany({
      where: { organizationId },
      orderBy: [{ departmentId: "asc" }, { version: "desc" }],
    });
  }

  async find(organizationId: string, id: string): Promise<Policy> {
    const policy = await this.prisma.policy.findFirst({
      where: { id, organizationId },
    });
    if (!policy) throw new NotFoundException("Policy not found");
    return policy;
  }

  private validate(input: unknown): PolicyDocument {
    try {
      return parsePolicyDocument(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid policy",
      );
    }
  }

  private async validateSources(
    tx: Prisma.TransactionClient,
    organizationId: string,
    doc: PolicyDocument,
  ): Promise<void> {
    const count = await tx.source.count({
      where: { organizationId, id: { in: doc.allowedSourceIds } },
    });
    if (count !== doc.allowedSourceIds.length) {
      throw new BadRequestException(
        "allowedSourceIds must reference existing sources in your Organization",
      );
    }
  }

  private async inDepartment<T>(
    organizationId: string,
    departmentId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // The Department row serializes every policy mutation, including version allocation.
      const locked = await tx.department.updateMany({
        where: { id: departmentId, organizationId },
        data: { updatedAt: new Date() },
      });
      if (!locked.count)
        throw new NotFoundException(
          "Department not found in your Organization",
        );
      return operation(tx);
    });
  }

  async create(
    organizationId: string,
    departmentId: string,
    input: unknown,
  ): Promise<Policy> {
    const doc = this.validate(input);
    return this.inDepartment(organizationId, departmentId, async (tx) => {
      await this.validateSources(tx, organizationId, doc);
      const latest = await tx.policy.findFirst({
        where: { organizationId, departmentId },
        orderBy: { version: "desc" },
      });
      return tx.policy.create({
        data: {
          organizationId,
          departmentId,
          version: (latest?.version ?? 0) + 1,
          rulesJson: doc as unknown as Prisma.InputJsonValue,
          isActive: false,
        },
      });
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: unknown,
  ): Promise<Policy> {
    const doc = this.validate(input);
    const existing = await this.find(organizationId, id);
    return this.inDepartment(
      organizationId,
      existing.departmentId,
      async (tx) => {
        const policy = await tx.policy.findFirst({
          where: { id, organizationId },
        });
        if (!policy) throw new NotFoundException("Policy not found");
        if (policy.isActive)
          throw new ConflictException(
            "Deactivate the policy before editing it, or create a new version",
          );
        await this.validateSources(tx, organizationId, doc);
        return tx.policy.update({
          where: { id, organizationId },
          data: { rulesJson: doc as unknown as Prisma.InputJsonValue },
        });
      },
    );
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const existing = await this.find(organizationId, id);
    await this.inDepartment(
      organizationId,
      existing.departmentId,
      async (tx) => {
        const policy = await tx.policy.findFirst({
          where: { id, organizationId },
        });
        if (!policy) throw new NotFoundException("Policy not found");
        if (policy.isActive)
          throw new ConflictException(
            "Deactivate the policy before deleting it",
          );
        await tx.policy.delete({ where: { id, organizationId } });
      },
    );
  }

  async setActive(
    organizationId: string,
    id: string,
    active: boolean,
  ): Promise<Policy> {
    const existing = await this.find(organizationId, id);
    return this.inDepartment(
      organizationId,
      existing.departmentId,
      async (tx) => {
        const policy = await tx.policy.findFirst({
          where: { id, organizationId },
        });
        if (!policy) throw new NotFoundException("Policy not found");
        if (active) {
          await this.validateSources(
            tx,
            organizationId,
            this.validate(policy.rulesJson),
          );
          await tx.policy.updateMany({
            where: {
              organizationId,
              departmentId: existing.departmentId,
              isActive: true,
            },
            data: { isActive: false },
          });
        }
        return tx.policy.update({
          where: { id, organizationId },
          data: { isActive: active },
        });
      },
    );
  }
}
