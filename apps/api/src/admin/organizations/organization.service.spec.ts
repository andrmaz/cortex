import { Test, type TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { PrismaService } from "../../prisma/prisma.service";

const now = new Date("2024-01-01T00:00:00Z");

const mockOrg = {
  id: "org-1",
  name: "acme.com",
  createdAt: now,
  updatedAt: now,
};

const mockPrisma = {
  organization: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe("OrganizationService", () => {
  let service: OrganizationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  describe("findAll", () => {
    it("returns all organizations ordered by createdAt desc", async () => {
      mockPrisma.organization.findMany.mockResolvedValue([mockOrg]);

      const result = await service.findAll();

      expect(result).toEqual([mockOrg]);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns an empty array when no organizations exist", async () => {
      mockPrisma.organization.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("returns the organization when found", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await service.findOne("org-1");

      expect(result).toEqual(mockOrg);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-1" },
      });
    });

    it("throws NotFoundException when organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne("missing-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("includes the id in the NotFoundException message", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne("missing-id")).rejects.toThrow(
        'Organization with id "missing-id" not found',
      );
    });
  });

  describe("create", () => {
    it("creates and returns the organization", async () => {
      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await service.create({ name: "acme.com" });

      expect(result).toEqual(mockOrg);
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: { name: "acme.com" },
      });
    });

    it("throws ConflictException on P2002 unique constraint violation", async () => {
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.organization.create.mockRejectedValue(p2002);

      await expect(service.create({ name: "acme.com" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("ConflictException message includes the duplicate name", async () => {
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.organization.create.mockRejectedValue(p2002);

      await expect(service.create({ name: "acme.com" })).rejects.toThrow(
        'Organization with name "acme.com" already exists',
      );
    });

    it("re-throws non-P2002 database errors", async () => {
      const dbError = Object.assign(new Error("Connection refused"), {
        code: "P1001",
      });
      mockPrisma.organization.create.mockRejectedValue(dbError);

      await expect(service.create({ name: "acme.com" })).rejects.toThrow(
        "Connection refused",
      );
    });
  });

  describe("update", () => {
    it("updates and returns the organization", async () => {
      const updated = { ...mockOrg, name: "newname.com" };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.organization.update.mockResolvedValue(updated);

      const result = await service.update("org-1", { name: "newname.com" });

      expect(result).toEqual(updated);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { name: "newname.com" },
      });
    });

    it("throws NotFoundException when the organization does not exist", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.update("missing-id", { name: "new" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on P2002 during update", async () => {
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.organization.update.mockRejectedValue(p2002);

      await expect(
        service.update("org-1", { name: "taken.com" }),
      ).rejects.toThrow(ConflictException);
    });

    it("applies no data update when dto is empty", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.organization.update.mockResolvedValue(mockOrg);

      await service.update("org-1", {});

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {},
      });
    });
  });
});
