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

type FixtureClient = Pick<
  PrismaService,
  "organization" | "user" | "department"
>;

/** Idempotently provisions the fixture organization, admin user and department. */
export async function seedGoogleOrgFixture(
  prisma: FixtureClient,
): Promise<{ organizationId: string; adminUserId: string }> {
  return runWithoutOrgScope(async () => {
    const organization = await prisma.organization.upsert({
      where: { name: GOOGLE_ORG_FIXTURE.organizationName },
      update: {},
      create: { name: GOOGLE_ORG_FIXTURE.organizationName },
    });

    const admin = await prisma.user.upsert({
      where: { email: GOOGLE_ORG_FIXTURE.adminEmail },
      update: { role: "admin", organizationId: organization.id },
      create: {
        email: GOOGLE_ORG_FIXTURE.adminEmail,
        googleSub: GOOGLE_ORG_FIXTURE.adminGoogleSub,
        role: "admin",
        organizationId: organization.id,
      },
    });

    await prisma.department.upsert({
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

    return { organizationId: organization.id, adminUserId: admin.id };
  });
}
