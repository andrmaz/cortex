import { IdentityService } from "./identity.service";
import type { PrismaService } from "../prisma/prisma.service";

/** Minimal mock shape for PrismaService covering only what IdentityService uses. */
function makeMockPrisma() {
  return {
    userDepartment: {
      findFirst: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;
}

describe("IdentityService", () => {
  let service: IdentityService;
  let prisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new IdentityService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("resolveScope", () => {
    it("returns organizationId and departmentId when a primary department exists", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce({
        id: "ud_1",
        userId: "user_123",
        departmentId: "dept_789",
        isPrimary: true,
      });

      const result = await service.resolveScope("user_123", "org_456");

      expect(result).toEqual({
        organizationId: "org_456",
        departmentId: "dept_789",
      });
    });

    it("returns null departmentId when no primary department row exists", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      const result = await service.resolveScope("user_no_dept", "org_456");

      expect(result).toEqual({
        organizationId: "org_456",
        departmentId: null,
      });
    });

    it("queries userDepartment with userId and isPrimary: true", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      await service.resolveScope("user_abc", "org_xyz");

      expect(prisma.userDepartment.findFirst).toHaveBeenCalledWith({
        where: { userId: "user_abc", isPrimary: true },
      });
    });

    it("passes organizationId through from the parameter, not from the database", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce({
        id: "ud_2",
        userId: "user_123",
        departmentId: "dept_from_db",
        isPrimary: true,
      });

      const result = await service.resolveScope("user_123", "org_from_jwt");

      expect(result.organizationId).toBe("org_from_jwt");
    });

    it("uses departmentId from the matched UserDepartment row, not the row's own id", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce({
        id: "join_table_row_id",
        userId: "user_123",
        departmentId: "the_real_dept_id",
        isPrimary: true,
      });

      const result = await service.resolveScope("user_123", "org_456");

      expect(result.departmentId).toBe("the_real_dept_id");
      expect(result.departmentId).not.toBe("join_table_row_id");
    });

    it("forwards the exact userId to the prisma query", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      await service.resolveScope("user_exact_id_check", "org_456");

      expect(prisma.userDepartment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user_exact_id_check" }),
        }),
      );
    });

    it("always queries with isPrimary: true regardless of what the db returns", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce({
        id: "ud_3",
        userId: "user_123",
        departmentId: "dept_456",
        isPrimary: true,
      });

      await service.resolveScope("user_123", "org_456");

      expect(prisma.userDepartment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPrimary: true }),
        }),
      );
    });

    it("calls userDepartment.findFirst exactly once per resolveScope call", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      await service.resolveScope("user_123", "org_456");

      expect(prisma.userDepartment.findFirst).toHaveBeenCalledTimes(1);
    });

    it("issues separate db queries for separate resolveScope calls", async () => {
      prisma.userDepartment.findFirst
        .mockResolvedValueOnce({ id: "ud_a", userId: "user_a", departmentId: "dept_a", isPrimary: true })
        .mockResolvedValueOnce(null);

      const [resultA, resultB] = await Promise.all([
        service.resolveScope("user_a", "org_a"),
        service.resolveScope("user_b", "org_b"),
      ]);

      expect(prisma.userDepartment.findFirst).toHaveBeenCalledTimes(2);
      expect(resultA.departmentId).toBe("dept_a");
      expect(resultB.departmentId).toBeNull();
    });

    it("returns a Promise", () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      const returnValue = service.resolveScope("user_123", "org_456");

      expect(returnValue).toBeInstanceOf(Promise);
    });

    it("different users with the same organizationId get independent dept lookups", async () => {
      prisma.userDepartment.findFirst
        .mockResolvedValueOnce({ id: "ud_1", userId: "user_1", departmentId: "dept_for_user1", isPrimary: true })
        .mockResolvedValueOnce({ id: "ud_2", userId: "user_2", departmentId: "dept_for_user2", isPrimary: true });

      const result1 = await service.resolveScope("user_1", "shared_org");
      const result2 = await service.resolveScope("user_2", "shared_org");

      expect(result1.departmentId).toBe("dept_for_user1");
      expect(result2.departmentId).toBe("dept_for_user2");
      expect(result1.organizationId).toBe("shared_org");
      expect(result2.organizationId).toBe("shared_org");
    });

    it("handles an empty string userId without throwing", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce(null);

      const result = await service.resolveScope("", "org_456");

      expect(result.departmentId).toBeNull();
      expect(result.organizationId).toBe("org_456");
      expect(prisma.userDepartment.findFirst).toHaveBeenCalledWith({
        where: { userId: "", isPrimary: true },
      });
    });

    it("propagates errors thrown by the prisma query", async () => {
      const dbError = new Error("Database connection lost");
      prisma.userDepartment.findFirst.mockRejectedValueOnce(dbError);

      await expect(service.resolveScope("user_123", "org_456")).rejects.toThrow(
        "Database connection lost",
      );
    });

    it("scope object has exactly the organizationId and departmentId keys", async () => {
      prisma.userDepartment.findFirst.mockResolvedValueOnce({
        id: "ud_1",
        userId: "user_123",
        departmentId: "dept_789",
        isPrimary: true,
      });

      const result = await service.resolveScope("user_123", "org_456");

      expect(Object.keys(result).sort()).toEqual(
        ["departmentId", "organizationId"].sort(),
      );
    });
  });
});
