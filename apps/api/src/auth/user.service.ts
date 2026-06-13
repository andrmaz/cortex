import { Injectable } from "@nestjs/common";
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
   * If the user does not exist yet, provision a placeholder record.
   *
   * Note: A real implementation should derive the organizationId from the
   * verified domain or an invite flow. For now we defer that to post-MVP work
   * and store an empty sentinel value that signals "pending org assignment".
   */
  async findOrCreate(input: UpsertUserInput): Promise<User> {
    const existing = await this.findByGoogleSub(input.googleSub);
    if (existing) {
      return existing;
    }

    // Resolve organization by email domain (best-effort; will be null for
    // domains that have not yet been provisioned).
    const domain = input.email.split("@")[1] ?? "";
    const org = await this.prisma.organization.findFirst({
      where: { name: domain },
    });

    return this.prisma.user.create({
      data: {
        googleSub: input.googleSub,
        email: input.email,
        role: "member",
        organizationId: org?.id ?? "",
      },
    });
  }
}
