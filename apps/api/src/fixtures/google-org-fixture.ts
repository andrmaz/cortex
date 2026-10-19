import { runWithoutOrgScope } from "db";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * A fake Google Workspace organization used by QA to log in to the admin
 * web app without a real Google account. The organization name is the
 * email domain, matching how `UserService.findOrCreate` resolves tenants.
 */
export const GOOGLE_ORG_FIXTURE = {
  organizationName: "fixture.test",
  adminEmail: "qa-admin@fixture.test",
  adminGoogleSub: "fixture-google-sub-qa-admin",
  departmentName: "QA",
} as const;

type FixtureClient = Pick<PrismaService, "user" | "$transaction">;

export class FixtureConflictError extends Error {}

/**
 * Idempotently provisions the fixture organization, admin user and
 * department. Refuses to touch pre-existing identities that are not the
 * fixture's own (it never re-homes or elevates another user).
 */
export async function seedGoogleOrgFixture(
  prisma: FixtureClient,
): Promise<{ organizationId: string; adminUserId: string }> {
  return runWithoutOrgScope(async () => {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: GOOGLE_ORG_FIXTURE.adminEmail },
    });
    const existingBySub = await prisma.user.findUnique({
      where: { googleSub: GOOGLE_ORG_FIXTURE.adminGoogleSub },
    });
    const isFixtureUser = (user: typeof existingByEmail): boolean =>
      user?.email === GOOGLE_ORG_FIXTURE.adminEmail &&
      user.googleSub === GOOGLE_ORG_FIXTURE.adminGoogleSub;
    if (
      (existingByEmail && !isFixtureUser(existingByEmail)) ||
      (existingBySub && !isFixtureUser(existingBySub))
    ) {
      throw new FixtureConflictError(
        "A non-fixture user already uses the fixture email or Google subject",
      );
    }

    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { name: GOOGLE_ORG_FIXTURE.organizationName },
        update: {},
        create: { name: GOOGLE_ORG_FIXTURE.organizationName },
      });

      if (
        existingByEmail &&
        existingByEmail.organizationId !== organization.id
      ) {
        throw new FixtureConflictError(
          "Fixture user belongs to a different organization",
        );
      }

      const admin = await tx.user.upsert({
        where: { email: GOOGLE_ORG_FIXTURE.adminEmail },
        update: { role: "admin" },
        create: {
          email: GOOGLE_ORG_FIXTURE.adminEmail,
          googleSub: GOOGLE_ORG_FIXTURE.adminGoogleSub,
          role: "admin",
          organizationId: organization.id,
        },
      });

      const department = await tx.department.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: GOOGLE_ORG_FIXTURE.departmentName,
          },
        },
        update: {},
        create: {
          name: GOOGLE_ORG_FIXTURE.departmentName,
          organizationId: organization.id,
        },
      });

      await tx.userDepartment.updateMany({
        where: {
          userId: admin.id,
          isPrimary: true,
          NOT: { departmentId: department.id },
        },
        data: { isPrimary: false },
      });

      await tx.userDepartment.upsert({
        where: {
          userId_departmentId: {
            userId: admin.id,
            departmentId: department.id,
          },
        },
        update: { isPrimary: true },
        create: {
          userId: admin.id,
          departmentId: department.id,
          isPrimary: true,
        },
      });

      return { organizationId: organization.id, adminUserId: admin.id };
    });
  });
}
