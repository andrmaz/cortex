import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { OrgScopeViolationError } from "db";

/**
 * Maps a query-layer tenant-boundary violation (see `db`'s
 * `OrgScopeViolationError`, thrown by the org-scoping Prisma extension when
 * a write references a record outside the caller's organization) to 403
 * Forbidden. This is the last line of defense — application code should
 * already prevent cross-org references at the controller/service level —
 * but it ensures the query layer's enforcement is never silently swallowed
 * as an unhandled 500.
 */
@Catch(OrgScopeViolationError)
export class OrgScopeExceptionFilter implements ExceptionFilter {
  catch(_exception: OrgScopeViolationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.FORBIDDEN).json({
      statusCode: HttpStatus.FORBIDDEN,
      message: "Forbidden",
    });
  }
}
