import { Test, type TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { DepartmentService } from "./department.service";
import { PrismaService } from "../../prisma/prisma.service";

const now = new Date("2024-01-01T00:00:00Z");

const mockOrg = { id: "org-1", name: "acme.com" };

const mockDept = {
  id: "dept-1",
  name: "Engineering",
  organizationId: "org-1",
  createdAt: now,
  updatedAt: now,
};

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe("DepartmentService", () => {
  let service: DepartmentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  describe("findAllByOrganization", () => {
    it("returns departments scoped to the organization, ordered by createdAt desc", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.department.findMany.mockResolvedValue([mockDept]);

      const result = await service.findAllByOrganization("org-1");

      expect(result).toEqual([mockDept]);
      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns an empty array when the organization has no departments", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.department.findMany.mockResolvedValue([]);

      const result = await service.findAllByOrganization("org-1");

      expect(result).toEqual([]);
    });

    it("throws NotFoundException when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllByOrganization("missing-org"),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.department.findMany).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("creates and returns the department scoped to the organization", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.department.create.mockResolvedValue(mockDept);

      const result = await service.create("org-1", { name: "Engineering" });

      expect(result).toEqual(mockDept);
      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: { name: "Engineering", organizationId: "org-1" },
      });
    });

    it("throws NotFoundException when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.create("missing-org", { name: "Engineering" }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });

    it("throws ConflictException on P2002 unique constraint violation", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.department.create.mockRejectedValue(p2002);

      await expect(
        service.create("org-1", { name: "Engineering" }),
      ).rejects.toThrow(ConflictException);
    });

    it("re-throws non-P2002 database errors", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      const dbError = Object.assign(new Error("Connection refused"), {
        code: "P1001",
      });
      mockPrisma.department.create.mockRejectedValue(dbError);

      await expect(
        service.create("org-1", { name: "Engineering" }),
      ).rejects.toThrow("Connection refused");
    });
  });
});
