import { randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedUser, JwtPayload } from "./auth.types";

/** Short-lived one-time codes used to hand a JWT to the web app without putting it in a URL. */
const ONE_TIME_CODE_TTL_MS = 60_000;

interface PendingCode {
  token: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly pendingCodes = new Map<string, PendingCode>();

  constructor(private readonly jwtService: JwtService) {}

  issueToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  issueOneTimeCode(token: string): string {
    this.pruneExpiredCodes();
    const code = randomBytes(32).toString("base64url");
    this.pendingCodes.set(code, {
      token,
      expiresAt: Date.now() + ONE_TIME_CODE_TTL_MS,
    });
    return code;
  }

  consumeOneTimeCode(code: string): string {
    const pending = this.pendingCodes.get(code);
    this.pendingCodes.delete(code);
    if (!pending || pending.expiresAt <= Date.now()) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    return pending.token;
  }

  verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  decodeToken(token: string): JwtPayload | null {
    return this.jwtService.decode<JwtPayload>(token);
  }

  private pruneExpiredCodes(): void {
    const now = Date.now();
    for (const [code, pending] of this.pendingCodes) {
      if (pending.expiresAt <= now) {
        this.pendingCodes.delete(code);
      }
    }
  }
}
