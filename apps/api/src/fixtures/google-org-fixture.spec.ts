import {
  FixtureConflictError,
  GOOGLE_ORG_FIXTURE,
  seedGoogleOrgFixture,
} from "./google-org-fixture";
import type { PrismaService } from "../prisma/prisma.service";

function makePrisma(users: { byEmail?: object | null; bySub?: object | null }) {
  const client = {
    organization: { upsert: jest.fn().mockResolvedValue({ id: "org-1" }) },
    user: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { email?: string } }) =>
          Promise.resolve((where.email ? users.byEmail : users.bySub) ?? null),
        ),
      upsert: jest.fn().mockResolvedValue({ id: "user-1" }),
    },
    department: { upsert: jest.fn().mockResolvedValue({ id: "dept-1" }) },
    userDepartment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(client),
  );
  return client;
}

const fixtureUser = {
  email: GOOGLE_ORG_FIXTURE.adminEmail,
  googleSub: GOOGLE_ORG_FIXTURE.adminGoogleSub,
  organizationId: "org-1",
};

describe("seedGoogleOrgFixture", () => {
  it("upserts org, admin, department and primary assignment", async () => {
    const prisma = makePrisma({});
    const result = await seedGoogleOrgFixture(
      prisma as unknown as PrismaService,
    );

    expect(result).toEqual({ organizationId: "org-1", adminUserId: "user-1" });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          role: "admin",
          organizationId: "org-1",
        }),
      }),
    );
    expect(prisma.userDepartment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPrimary: true }),
      }),
    );
  });

  it("clears other primary assignments before upserting the fixture one", async () => {
    const prisma = makePrisma({ byEmail: fixtureUser, bySub: fixtureUser });
    await seedGoogleOrgFixture(prisma as unknown as PrismaService);

    expect(prisma.userDepartment.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isPrimary: true,
        NOT: { departmentId: "dept-1" },
      },
      data: { isPrimary: false },
    });
    expect(
      prisma.userDepartment.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.userDepartment.upsert.mock.invocationCallOrder[0]);
  });

  it("is idempotent for an existing fixture user", async () => {
    const prisma = makePrisma({ byEmail: fixtureUser, bySub: fixtureUser });
    await expect(
      seedGoogleOrgFixture(prisma as unknown as PrismaService),
    ).resolves.toBeDefined();
  });

  it("rejects a non-fixture user holding the fixture email", async () => {
    const prisma = makePrisma({
      byEmail: { ...fixtureUser, googleSub: "other", organizationId: "x" },
    });
    await expect(
      seedGoogleOrgFixture(prisma as unknown as PrismaService),
    ).rejects.toBeInstanceOf(FixtureConflictError);
    expect(prisma.organization.upsert).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("rejects a different user holding the fixture Google subject", async () => {
    const prisma = makePrisma({
      bySub: { ...fixtureUser, email: "someone@else.com" },
    });
    await expect(
      seedGoogleOrgFixture(prisma as unknown as PrismaService),
    ).rejects.toBeInstanceOf(FixtureConflictError);
    expect(prisma.organization.upsert).not.toHaveBeenCalled();
  });
});
