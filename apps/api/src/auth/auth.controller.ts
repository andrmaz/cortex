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
import type { AuthenticatedUser } from "./auth.types";

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
   * We upsert the user, issue a JWT, and return it.
   */
  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const { googleSub, email } = req.user;

    const dbUser = await this.userService.findOrCreate({ googleSub, email });

    const authenticatedUser: AuthenticatedUser = {
      id: dbUser.id,
      email: dbUser.email,
      organizationId: dbUser.organizationId,
      role: dbUser.role,
    };

    const token = this.authService.issueToken(authenticatedUser);

    res.json({ accessToken: token });
  }
}

@Controller("api")
export class MeController {
  /** Returns the identity of the currently authenticated user. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getMe(@Req() req: RequestWithJwtUser): AuthenticatedUser {
    return req.user;
  }
}
