import { Test, type TestingModule } from "@nestjs/testing";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
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
    upsert: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
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
    it("returns an existing user without touching org or create", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOrCreate({
        googleSub: "google-sub-123",
        email: "alice@acme.com",
      });

      expect(result).toBe(mockUser);
      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
    });

    it("creates a new user when org is found for the email domain", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
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

    it("queries org using findUnique on the domain (Organization.name is @unique)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "bob@example.org",
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { name: "example.org" },
      });
    });

    it("throws UnauthorizedException when no org matches the email domain", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "alice@unknown.com",
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for email without @ symbol", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "notanemail",
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for email starting with @ (empty local part)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "@domain.com",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("does not include PII in BadRequestException message", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      let caughtMessage = "";
      try {
        await service.findOrCreate({
          googleSub: "google-sub-123",
          email: "bademailformat",
        });
      } catch (err) {
        if (err instanceof BadRequestException) {
          caughtMessage = err.message;
        }
      }

      expect(caughtMessage).toBe("Invalid email format");
      expect(caughtMessage).not.toContain("bademailformat");
    });

    it("recovers from a concurrent-creation race via upsert on P2002", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // pre-check returns null
        .mockResolvedValue(undefined); // not called in upsert path
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.user.create.mockRejectedValue(p2002);
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      const result = await service.findOrCreate({
        googleSub: "google-sub-123",
        email: "alice@acme.com",
      });

      expect(result).toBe(mockUser);
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { googleSub: "google-sub-123" },
        update: {},
        create: {
          googleSub: "google-sub-123",
          email: "alice@acme.com",
          role: "member",
          organizationId: "org-1",
        },
      });
    });

    it("re-throws non-P2002 database errors", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const dbError = Object.assign(new Error("Connection refused"), {
        code: "P1001",
      });
      mockPrisma.user.create.mockRejectedValue(dbError);

      await expect(
        service.findOrCreate({
          googleSub: "google-sub-123",
          email: "alice@acme.com",
        }),
      ).rejects.toThrow("Connection refused");

      expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
    });
  });
});
