import { Test, type TestingModule } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser, JwtPayload } from "./auth.types";

const TEST_SECRET = "test-secret-for-unit-tests";

const mockUser: AuthenticatedUser = {
  id: "user-1",
  email: "alice@example.com",
  organizationId: "org-1",
  role: "member",
};

describe("AuthService", () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: "1h" },
        }),
      ],
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe("issueToken", () => {
    it("returns a non-empty JWT string", () => {
      const token = service.issueToken(mockUser);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("encodes sub, email, organizationId, and role in the payload", () => {
      const token = service.issueToken(mockUser);
      const payload = jwtService.decode<JwtPayload>(token);

      expect(payload?.sub).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
      expect(payload?.organizationId).toBe(mockUser.organizationId);
      expect(payload?.role).toBe(mockUser.role);
    });

    it("produces tokens with iat and exp claims", () => {
      const token = service.issueToken(mockUser);
      const payload = jwtService.decode<JwtPayload>(token);

      expect(payload?.iat).toBeDefined();
      expect(payload?.exp).toBeDefined();
      expect((payload?.exp ?? 0) > (payload?.iat ?? 0)).toBe(true);
    });
  });

  describe("verifyToken", () => {
    it("returns the decoded payload for a valid token", () => {
      const token = service.issueToken(mockUser);
      const payload = service.verifyToken(token);

      expect(payload.sub).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.organizationId).toBe(mockUser.organizationId);
      expect(payload.role).toBe(mockUser.role);
    });

    it("throws UnauthorizedException for a tampered token", () => {
      const token = service.issueToken(mockUser);
      const tampered = token.slice(0, -5) + "XXXXX";

      expect(() => service.verifyToken(tampered)).toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException for a token signed with a different secret", () => {
      const foreignToken = jwtService.sign(
        { sub: "other", email: "b@b.com", organizationId: "o2", role: "admin" },
        { secret: "wrong-secret" },
      );

      expect(() => service.verifyToken(foreignToken)).toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException for a malformed token string", () => {
      expect(() => service.verifyToken("not.a.jwt")).toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException for an expired token", async () => {
      const expiredToken = jwtService.sign(
        {
          sub: mockUser.id,
          email: mockUser.email,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
        },
        { expiresIn: "0s" },
      );

      // Allow the clock to advance past expiry
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(() => service.verifyToken(expiredToken)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("decodeToken", () => {
    it("returns the payload without signature verification", () => {
      const token = service.issueToken(mockUser);
      const payload = service.decodeToken(token);

      expect(payload?.sub).toBe(mockUser.id);
    });

    it("returns null for a completely invalid string", () => {
      const payload = service.decodeToken("garbage");
      expect(payload).toBeNull();
    });
  });
});
