import { Test, type TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { UserDepartmentService } from "./user-department.service";
import { PrismaService } from "../../prisma/prisma.service";

const mockUser = {
  id: "user-1",
  email: "alice@acme.com",
  googleSub: "google-sub-1",
  role: "member",
  organizationId: "org-1",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const mockAssignmentRows = [
  {
    departmentId: "dept-1",
    isPrimary: true,
    department: { name: "Engineering" },
  },
];

const mockPrisma = {
  user: { findUnique: jest.fn() },
  department: { findMany: jest.fn() },
  userDepartment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("UserDepartmentService", () => {
  let service: UserDepartmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDepartmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserDepartmentService>(UserDepartmentService);
  });

  describe("findForUser", () => {
    it("returns department assignments joined with department name", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userDepartment.findMany.mockResolvedValue(mockAssignmentRows);

      const result = await service.findForUser("user-1");

      expect(result).toEqual(mockAssignmentRows);
      expect(mockPrisma.userDepartment.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        include: { department: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
    });

    it("throws NotFoundException when the user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findForUser("missing-user")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.userDepartment.findMany).not.toHaveBeenCalled();
    });
  });

  describe("assign", () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.department.findMany.mockResolvedValue([
        { id: "dept-1" },
        { id: "dept-2" },
      ]);
      mockPrisma.userDepartment.findFirst.mockResolvedValue(null);
      mockPrisma.userDepartment.findMany.mockResolvedValue(mockAssignmentRows);
    });

    it("throws NotFoundException when the user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assign("missing-user", { departmentIds: ["dept-1"] }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when departmentIds is empty", async () => {
      await expect(
        service.assign("user-1", { departmentIds: [] }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when primaryDepartmentId is not in departmentIds", async () => {
      await expect(
        service.assign("user-1", {
          departmentIds: ["dept-1"],
          primaryDepartmentId: "dept-2",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when a departmentId does not belong to the user's organization", async () => {
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);

      await expect(
        service.assign("user-1", { departmentIds: ["dept-1", "dept-2"] }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("scopes the department existence check to the user's organization", async () => {
      await service.assign("user-1", { departmentIds: ["dept-1", "dept-2"] });

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["dept-1", "dept-2"] },
          organizationId: "org-1",
        },
        select: { id: true },
      });
    });

    it("dedupes repeated departmentIds before validating and writing", async () => {
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);

      await service.assign("user-1", {
        departmentIds: ["dept-1", "dept-1"],
      });

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["dept-1"] }, organizationId: "org-1" },
        select: { id: true },
      });
    });

    it("uses the explicit primaryDepartmentId when provided", async () => {
      await service.assign("user-1", {
        departmentIds: ["dept-1", "dept-2"],
        primaryDepartmentId: "dept-2",
      });

      expect(mockPrisma.userDepartment.upsert).toHaveBeenCalledWith({
        where: {
          userId_departmentId: { userId: "user-1", departmentId: "dept-2" },
        },
        update: { isPrimary: true },
        create: { userId: "user-1", departmentId: "dept-2", isPrimary: true },
      });
      expect(mockPrisma.userDepartment.upsert).toHaveBeenCalledWith({
        where: {
          userId_departmentId: { userId: "user-1", departmentId: "dept-1" },
        },
        update: { isPrimary: false },
        create: { userId: "user-1", departmentId: "dept-1", isPrimary: false },
      });
    });

    it("keeps the existing primary department when it is still in the new set", async () => {
      mockPrisma.userDepartment.findFirst.mockResolvedValue({
        departmentId: "dept-2",
      });

      await service.assign("user-1", { departmentIds: ["dept-1", "dept-2"] });

      expect(mockPrisma.userDepartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_departmentId: { userId: "user-1", departmentId: "dept-2" },
          },
          update: { isPrimary: true },
        }),
      );
    });

    it("defaults primary to the first departmentId when there is no existing primary", async () => {
      mockPrisma.userDepartment.findFirst.mockResolvedValue(null);

      await service.assign("user-1", { departmentIds: ["dept-1", "dept-2"] });

      expect(mockPrisma.userDepartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_departmentId: { userId: "user-1", departmentId: "dept-1" },
          },
          update: { isPrimary: true },
        }),
      );
    });

    it("clears existing primary flags before applying the new assignment set", async () => {
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);

      await service.assign("user-1", { departmentIds: ["dept-1"] });

      expect(mockPrisma.userDepartment.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { isPrimary: false },
      });
    });

    it("deletes assignments for departments no longer in the set", async () => {
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);

      await service.assign("user-1", { departmentIds: ["dept-1"] });

      expect(mockPrisma.userDepartment.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", departmentId: { notIn: ["dept-1"] } },
      });
    });

    it("runs the update, delete, and upserts inside a single transaction", async () => {
      await service.assign("user-1", { departmentIds: ["dept-1", "dept-2"] });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = mockPrisma.$transaction.mock.calls[0]?.[0] as unknown[];
      expect(ops).toHaveLength(4); // updateMany + deleteMany + 2 upserts
    });

    it("returns the refreshed assignment list after writing", async () => {
      mockPrisma.department.findMany.mockResolvedValue([{ id: "dept-1" }]);

      const result = await service.assign("user-1", {
        departmentIds: ["dept-1"],
      });

      expect(result).toEqual(mockAssignmentRows);
    });
  });
});
