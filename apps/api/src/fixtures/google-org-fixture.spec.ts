import { GOOGLE_ORG_FIXTURE, seedGoogleOrgFixture } from "./google-org-fixture";
import type { PrismaService } from "../prisma/prisma.service";

describe("seedGoogleOrgFixture", () => {
  it("upserts the organization, admin user and department", async () => {
    const prisma = {
      organization: { upsert: jest.fn().mockResolvedValue({ id: "org-1" }) },
      user: { upsert: jest.fn().mockResolvedValue({ id: "user-1" }) },
      department: { upsert: jest.fn().mockResolvedValue({ id: "dept-1" }) },
    };

    const result = await seedGoogleOrgFixture(
      prisma as unknown as PrismaService,
    );

    expect(result).toEqual({ organizationId: "org-1", adminUserId: "user-1" });
    expect(prisma.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: GOOGLE_ORG_FIXTURE.organizationName },
      }),
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: GOOGLE_ORG_FIXTURE.adminEmail },
        create: expect.objectContaining({
          role: "admin",
          organizationId: "org-1",
        }),
      }),
    );
    expect(prisma.department.upsert).toHaveBeenCalledTimes(1);
  });
});
