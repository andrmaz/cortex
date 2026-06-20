import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ResolvedScope {
  organizationId: string;
  departmentId: string | null;
}

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the identity scope for a request.
   *
   * The organizationId comes directly from the validated JWT claim.
   * The departmentId is looked up from the UserDepartment join table,
   * selecting the row flagged as the user's Primary Department.
   * Returns null for departmentId when no primary department is configured.
   */
  async resolveScope(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedScope> {
    const primaryDept = await this.prisma.userDepartment.findFirst({
      where: { userId, isPrimary: true },
    });

    return {
      organizationId,
      departmentId: primaryDept?.departmentId ?? null,
    };
  }
}
