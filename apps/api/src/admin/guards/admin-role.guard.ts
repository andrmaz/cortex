import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../auth/auth.types";

interface RequestWithUser {
  user: AuthenticatedUser;
}

/**
 * Combines JWT authentication with an admin role check.
 * Requests from non-admin users receive 403 Forbidden after
 * the JWT is validated, not 401 – the user is authenticated
 * but not authorized.
 */
@Injectable()
export class AdminRoleGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser>();

    if (request.user.role !== "admin") {
      throw new ForbiddenException(
        "Admin role required to access this resource",
      );
    }

    return true;
  }
}
