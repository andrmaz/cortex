import { Test, type TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { UserService } from "./user.service";
import { PrismaService } from "../prisma/prisma.service";

const mockUser = {
  id: "user-1",
  email: "alice@acme.com",
  googleSub: "google-sub-123",
  organizationId: "org-1",
  role: "member",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOrg = { id: "org-1", name: "acme.com" };

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  organization: {
    findFirst: jest.fn(),
  },
};

describe("UserService", () => {
  let service: UserService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe("findOrCreate", () => {
    it("returns an existing user without creating a new one", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOrCreate({
        googleSub: "google-sub-123",
        email: "alice@acme.com",
      });

      expect(result).toBe(mockUser);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("creates a new user when org is found for the email domain", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.findOrCreate({
        googleSub: "google-sub-123",
        email: "alice@acme.com",
      });

      expect(result).toBe(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          googleSub: "google-sub-123",
          email: "alice@acme.com",
          role: "member",
          organizationId: "org-1",
        },
      });
    });

    it("throws UnauthorizedException when no org matches the email domain", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "alice@unknown.com",
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("throws Error for email without @ symbol", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "notanemail",
        }),
      ).rejects.toThrow("Invalid email format");

      expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    });

    it("throws Error for email starting with @ (empty local part)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "@domain.com",
        }),
      ).rejects.toThrow("Invalid email format");
    });

    it("queries org by the domain portion of the email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "bob@example.org",
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { name: "example.org" },
      });
    });
  });
});
