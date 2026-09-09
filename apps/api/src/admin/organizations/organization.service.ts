import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

function isPrismaNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}
import { PrismaService } from "../../prisma/prisma.service";
import type { Organization } from "db/client";
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from "./organization.dto";

import { isPrismaUniqueConstraintError } from "../../common/prisma-errors";

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }
    return org;
  }

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.create({
        data: { name: dto.name },
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException(
          `Organization with name "${dto.name}" already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    await this.findOne(id);

    try {
      return await this.prisma.organization.update({
        where: { id },
        data: { ...(dto.name !== undefined && { name: dto.name }) },
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException(
          `Organization with name "${dto.name}" already exists`,
        );
      }
      if (isPrismaNotFoundError(err)) {
        throw new NotFoundException(`Organization with id "${id}" not found`);
      }
      throw err;
    }
  }
}
