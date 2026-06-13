import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "db/client";

interface UpsertUserInput {
  googleSub: string;
  email: string;
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
   * Look up an existing user by Google subject ID.
   * If the user does not exist yet, provision a new record.
   *
   * The user's email domain must match a pre-registered Organization.
   * Sign-in is rejected when no matching organization is found so that tokens
   * are never issued with an empty or invalid organizationId.
   */
  async findOrCreate(input: UpsertUserInput): Promise<User> {
    const existing = await this.findByGoogleSub(input.googleSub);
    if (existing) {
      return existing;
    }

    const atIndex = input.email.indexOf("@");
    if (atIndex <= 0) {
      throw new Error(`Invalid email format: ${input.email}`);
    }
    const domain = input.email.slice(atIndex + 1);
    if (!domain) {
      throw new Error(`Invalid email format: ${input.email}`);
    }

    const org = await this.prisma.organization.findFirst({
      where: { name: domain },
    });

    if (!org) {
      throw new UnauthorizedException(
        `No organization provisioned for email domain "${domain}". ` +
          "Contact your administrator to register your domain.",
      );
    }

    return this.prisma.user.create({
      data: {
        googleSub: input.googleSub,
        email: input.email,
        role: "member",
        organizationId: org.id,
      },
    });
  }
}
