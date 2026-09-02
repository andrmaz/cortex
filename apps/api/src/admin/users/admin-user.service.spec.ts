import { Test, type TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AdminUserService } from "./admin-user.service";
import { PrismaService } from "../../prisma/prisma.service";

const mockOrg = { id: "org-1", name: "acme.com" };

const mockUser = {
  id: "user-1",
  email: "alice@acme.com",
  googleSub: "google-sub-1",
  role: "member",
  organizationId: "org-1",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const mockPrisma = {
  organization: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
};

describe("AdminUserService", () => {
  let service: AdminUserService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminUserService>(AdminUserService);
  });

  describe("findAllByOrganization", () => {
    it("returns users scoped to the organization, ordered by email", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAllByOrganization("org-1");

      expect(result).toEqual([mockUser]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { email: "asc" },
      });
    });

    it("throws NotFoundException when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllByOrganization("missing-org"),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
