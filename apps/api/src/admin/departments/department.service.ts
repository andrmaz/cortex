import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Department } from "db/client";
import type { CreateDepartmentDto } from "./department.dto";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors";

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists departments scoped to a single Organization.
   * Throws NotFoundException up front so callers get a clear 404 instead
   * of a silently empty list when the organizationId is bogus.
   */
  async findAllByOrganization(organizationId: string): Promise<Department[]> {
    await this.ensureOrganizationExists(organizationId);
    return this.prisma.department.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    organizationId: string,
    dto: CreateDepartmentDto,
  ): Promise<Department> {
    await this.ensureOrganizationExists(organizationId);

    try {
      return await this.prisma.department.create({
        data: { name: dto.name, organizationId },
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException(
          `Department with name "${dto.name}" already exists in this organization`,
        );
      }
      throw err;
    }
  }

  private async ensureOrganizationExists(
    organizationId: string,
  ): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }
  }
}
