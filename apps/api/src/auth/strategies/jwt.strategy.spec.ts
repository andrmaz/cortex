import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import type { JwtPayload } from "../auth.types";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env["JWT_SECRET"] = "test-secret";
    strategy = new JwtStrategy();
  });

  afterEach(() => {
    delete process.env["JWT_SECRET"];
  });

  describe("constructor", () => {
    it("throws when JWT_SECRET is missing", () => {
      delete process.env["JWT_SECRET"];
      expect(() => new JwtStrategy()).toThrow(
        "JWT_SECRET environment variable is required",
      );
    });
  });

  describe("validate", () => {
    const validPayload: JwtPayload = {
      sub: "user-1",
      email: "alice@example.com",
      organizationId: "org-1",
      role: "member",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("returns an AuthenticatedUser for a valid payload", () => {
      const user = strategy.validate(validPayload);

      expect(user).toEqual({
        id: "user-1",
        email: "alice@example.com",
        organizationId: "org-1",
        role: "member",
      });
    });

    it("throws UnauthorizedException when sub is missing", () => {
      const payload = { ...validPayload, sub: "" };
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when email is missing", () => {
      const payload = { ...validPayload, email: "" };
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when organizationId is missing", () => {
      const payload = { ...validPayload, organizationId: "" };
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });
  });
});
