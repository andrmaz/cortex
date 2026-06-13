import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "db/client";

interface UpsertUserInput {
  googleSub: string;
  email: string;
}

/**
 * Narrows an unknown thrown value to a Prisma unique-constraint error (P2002).
 * Avoids importing Prisma runtime types into the CommonJS API workspace.
 */
function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleSub } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
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
  }
}
