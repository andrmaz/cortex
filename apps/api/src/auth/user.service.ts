import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "db/client";
import { runWithoutOrgScope } from "db";

interface UpsertUserInput {
  googleSub: string;
  email: string;
}

export interface DepartmentAssignments {
  departmentIds: string[];
  primaryDepartmentId: string | null;
}

import { isPrismaUniqueConstraintError } from "../common/prisma-errors";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Looks up a user by their Google identity, independent of organization —
   * this runs during login, before the caller's org is known, so it must
   * bypass org scoping deliberately via `runWithoutOrgScope`.
   */
  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return runWithoutOrgScope(() =>
      this.prisma.user.findUnique({ where: { googleSub } }),
    );
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Resolves the department scope used to enrich the authenticated user's
   * session view (`GET /api/me`). Reads directly from the UserDepartment
   * junction rather than a token claim so that admin-driven department
   * assignment changes are visible immediately, without waiting for the
   * user's JWT to expire and be reissued.
   */
  async getDepartmentAssignments(
    userId: string,
  ): Promise<DepartmentAssignments> {
    const assignments = await this.prisma.userDepartment.findMany({
      where: { userId },
      select: { departmentId: true, isPrimary: true },
    });

    const primary = assignments.find((assignment) => assignment.isPrimary);

    return {
      departmentIds: assignments.map((assignment) => assignment.departmentId),
      primaryDepartmentId: primary?.departmentId ?? null,
    };
  }

  /**
   * Return an existing user (fast path) or provision a new one.
   *
   * New-user provisioning requires a pre-registered Organization whose
   * `name` matches the email domain. The lookup uses `findUnique` because
   * `Organization.name` carries a `@unique` constraint, making domain
   * resolution unambiguous.
   *
   * Creation is made race-safe with a create → upsert fallback: if two
   * concurrent OAuth callbacks race for the same `googleSub`, the second
   * hits the unique constraint (P2002) and falls through to upsert, which
   * no-ops on the existing row and returns it.
   */
  async findOrCreate(input: UpsertUserInput): Promise<User> {
    // The whole flow runs before the caller's organization is known (it's
    // what determines it, via the email domain lookup below), so it
    // deliberately bypasses org scoping via `runWithoutOrgScope`.
    return runWithoutOrgScope(async () => {
      // Fast path: returning users skip the org lookup entirely.
      const existing = await this.prisma.user.findUnique({
        where: { googleSub: input.googleSub },
      });
      if (existing) {
        return existing;
      }

      // Validate email format – no PII in the error message.
      const atIndex = input.email.indexOf("@");
      if (atIndex <= 0) {
        throw new BadRequestException("Invalid email format");
      }
      const domain = input.email.slice(atIndex + 1);
      if (!domain) {
        throw new BadRequestException("Invalid email format");
      }

      // Resolve organization by domain. Organization.name is @unique so
      // findUnique is safe and semantically correct here.
      const org = await this.prisma.organization.findUnique({
        where: { name: domain },
      });

      if (!org) {
        throw new UnauthorizedException(
          `No organization provisioned for email domain "${domain}". ` +
            "Contact your administrator to register your domain.",
        );
      }

      // Atomic create with race-condition recovery.
      // If a concurrent request already created this user, the unique
      // constraint on googleSub raises P2002; we upsert to return the
      // existing row without a second round-trip failure.
      try {
        return await this.prisma.user.create({
          data: {
            googleSub: input.googleSub,
            email: input.email,
            role: "member",
            organizationId: org.id,
          },
        });
      } catch (err) {
        if (isPrismaUniqueConstraintError(err)) {
          return await this.prisma.user.upsert({
            where: { googleSub: input.googleSub },
            update: {},
            create: {
              googleSub: input.googleSub,
              email: input.email,
              role: "member",
              organizationId: org.id,
            },
          });
        }
        throw err;
      }
    });
  }
}
