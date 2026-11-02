import { ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { PolicyService } from "./policy.service";

const now = new Date("2024-06-01T12:00:00Z");
const policy = {
  id: "policy-1",
  version: 1,
  rulesJson: { rules: ["Use TypeScript"] },
  isActive: false,
  organizationId: "org-1",
  departmentId: "dept-1",
  createdAt: now,
  updatedAt: now,
};

const transactionClient = {
  policy: {
    updateMany: vi.fn(),
    update: vi.fn(),
  },
};

const mockPrisma = {
  department: { findFirst: vi.fn() },
  policy: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe("PolicyService", () => {
  let service: PolicyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PolicyService(mockPrisma as unknown as PrismaService);
    mockPrisma.department.findFirst.mockResolvedValue({
      id: "dept-1",
      organizationId: "org-1",
    });
  });

  it("lists policy versions for a department in descending version order", async () => {
    mockPrisma.policy.findMany.mockResolvedValue([policy]);

    await expect(
      service.findAllByDepartment("org-1", "dept-1"),
    ).resolves.toEqual([policy]);
    expect(mockPrisma.policy.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", departmentId: "dept-1" },
      orderBy: { version: "desc" },
    });
  });

  it("creates the next inactive version", async () => {
    mockPrisma.policy.findFirst.mockResolvedValue({ version: 3 });
    mockPrisma.policy.create.mockResolvedValue({ ...policy, version: 4 });

    await service.createVersion("org-1", "dept-1", {
      rules: ["Use TypeScript"],
    });

    expect(mockPrisma.policy.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        departmentId: "dept-1",
        version: 4,
        rulesJson: { rules: ["Use TypeScript"] },
        isActive: false,
      },
    });
  });

  it("rejects a department outside the admin organization", async () => {
    mockPrisma.department.findFirst.mockResolvedValue(null);

    await expect(
      service.createVersion("org-1", "dept-2", { rules: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockPrisma.policy.create).not.toHaveBeenCalled();
  });

  it("reports a concurrent version number collision", async () => {
    mockPrisma.policy.findFirst.mockResolvedValue(null);
    mockPrisma.policy.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.createVersion("org-1", "dept-1", { rules: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("deactivates the department's active version before activating the target", async () => {
    const activePolicy = { ...policy, isActive: true };
    mockPrisma.policy.findFirst.mockResolvedValue(policy);
    transactionClient.policy.updateMany.mockResolvedValue({ count: 1 });
    transactionClient.policy.update.mockResolvedValue(activePolicy);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    await expect(service.activate("org-1", "policy-1")).resolves.toEqual(
      activePolicy,
    );
    expect(transactionClient.policy.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        departmentId: "dept-1",
        isActive: true,
      },
      data: { isActive: false },
    });
    expect(transactionClient.policy.update).toHaveBeenCalledWith({
      where: { id: "policy-1" },
      data: { isActive: true },
    });
  });

  it("deactivates a version without affecting other versions", async () => {
    const inactivePolicy = { ...policy, isActive: false };
    mockPrisma.policy.findFirst.mockResolvedValue({
      ...policy,
      isActive: true,
    });
    mockPrisma.policy.update.mockResolvedValue(inactivePolicy);

    await expect(service.deactivate("org-1", "policy-1")).resolves.toEqual(
      inactivePolicy,
    );
    expect(mockPrisma.policy.update).toHaveBeenCalledWith({
      where: { id: "policy-1" },
      data: { isActive: false },
    });
  });
});
