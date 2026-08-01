import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { User } from "db/client";
import type { AssignUserDepartmentsDto } from "./user-department.dto";

/**
 * Narrow local shape for a UserDepartment row joined with its Department.
 * Declared locally instead of importing Prisma's generated payload helper
 * type to keep this module decoupled from Prisma's runtime type plumbing.
 */
export interface UserDepartmentWithDepartment {
  departmentId: string;
  isPrimary: boolean;
  department: {
    name: string;
  };
}

@Injectable()
export class UserDepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: string): Promise<UserDepartmentWithDepartment[]> {
    await this.ensureUserExists(userId);

    return this.prisma.userDepartment.findMany({
      where: { userId },
      include: { department: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Replaces a user's department assignments with exactly the given set,
   * designating one department as primary. This is a set-replace (not an
   * additive merge) so admins can also remove a user from a department by
   * omitting it from departmentIds.
   *
   * Primary resolution order:
   * 1. dto.primaryDepartmentId, if provided (must be in departmentIds).
   * 2. The user's current primary department, if it is still in the set.
   * 3. The first entry in departmentIds.
   *
   * Writes run in a transaction that first clears every isPrimary flag for
   * the user before setting the new one, so the partial unique index
   * enforcing "one primary department per user" is never violated
   * mid-transaction.
   */
  async assign(
    userId: string,
    dto: AssignUserDepartmentsDto,
  ): Promise<UserDepartmentWithDepartment[]> {
    const user = await this.ensureUserExists(userId);

    const departmentIds = Array.from(new Set(dto.departmentIds));
    if (departmentIds.length === 0) {
      throw new BadRequestException(
        "departmentIds must contain at least one department",
      );
    }

    if (
      dto.primaryDepartmentId !== undefined &&
      !departmentIds.includes(dto.primaryDepartmentId)
    ) {
      throw new BadRequestException(
        "primaryDepartmentId must be included in departmentIds",
      );
    }

    const departments = await this.prisma.department.findMany({
      where: { id: { in: departmentIds }, organizationId: user.organizationId },
      select: { id: true },
    });
    if (departments.length !== departmentIds.length) {
      throw new BadRequestException(
        "One or more departmentIds do not exist in the user's organization",
      );
    }

    const primaryDepartmentId =
      dto.primaryDepartmentId ??
      (await this.resolveDefaultPrimary(userId, departmentIds));

    await this.prisma.$transaction([
      this.prisma.userDepartment.updateMany({
        where: { userId },
        data: { isPrimary: false },
      }),
      this.prisma.userDepartment.deleteMany({
        where: { userId, departmentId: { notIn: departmentIds } },
      }),
      ...departmentIds.map((departmentId) =>
        this.prisma.userDepartment.upsert({
          where: { userId_departmentId: { userId, departmentId } },
          update: { isPrimary: departmentId === primaryDepartmentId },
          create: {
            userId,
            departmentId,
            isPrimary: departmentId === primaryDepartmentId,
          },
        }),
      ),
    ]);

    return this.findForUser(userId);
  }

  private async resolveDefaultPrimary(
    userId: string,
    departmentIds: string[],
  ): Promise<string> {
    const existingPrimary = await this.prisma.userDepartment.findFirst({
      where: { userId, isPrimary: true, departmentId: { in: departmentIds } },
    });
    return existingPrimary?.departmentId ?? departmentIds[0];
  }

  private async ensureUserExists(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }
    return user;
  }
}
