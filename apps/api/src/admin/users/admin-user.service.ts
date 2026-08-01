import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { User } from "db/client";

@Injectable()
export class AdminUserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists users scoped to a single Organization, ordered by email so the
   * admin picker in the assignment UI stays stable and predictable.
   */
  async findAllByOrganization(organizationId: string): Promise<User[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }

    return this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { email: "asc" },
    });
  }
}
