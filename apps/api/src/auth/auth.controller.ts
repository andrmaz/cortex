import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { UserService } from "./user.service";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedUser, SessionResponseDto } from "./auth.types";

interface RequestWithUser extends Request {
  user: AuthenticatedUser & { googleSub: string };
}

interface RequestWithJwtUser extends Request {
  user: AuthenticatedUser;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  /** Initiates the Google OAuth consent screen redirect. */
  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Guard redirects to Google – no body needed.
  }

  /**
   * Google calls back here after the user grants consent.
   * findOrCreate throws UnauthorizedException when no organization is
   * provisioned for the user's email domain, so a JWT is only issued after
   * a valid organizationId is confirmed.
   */
  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const webUrl = process.env["CORTEX_WEB_URL"] ?? "http://localhost:3000";
    const callbackUrl = new URL("/auth/callback", webUrl);

    try {
      const { googleSub, email } = req.user;

      const dbUser = await this.userService.findOrCreate({ googleSub, email });

      const authenticatedUser: AuthenticatedUser = {
        id: dbUser.id,
        email: dbUser.email,
        organizationId: dbUser.organizationId,
        role: dbUser.role,
      };

      const token = this.authService.issueToken(authenticatedUser);

      callbackUrl.searchParams.set("accessToken", token);
      res.redirect(callbackUrl.toString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      callbackUrl.searchParams.set("error", message);
      res.redirect(callbackUrl.toString());
    }
  }
}

@Controller("api")
export class MeController {
  constructor(private readonly userService: UserService) {}

  /**
   * Returns the identity of the currently authenticated user, enriched with
   * their current department assignments. This is the "authenticated
   * user's session" view: JWT claims (id, email, organizationId, role) plus
   * department scope resolved live from the UserDepartment table.
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: RequestWithJwtUser): Promise<SessionResponseDto> {
    const { departmentIds, primaryDepartmentId } =
      await this.userService.getDepartmentAssignments(req.user.id);

    return { ...req.user, departmentIds, primaryDepartmentId };
  }
}
