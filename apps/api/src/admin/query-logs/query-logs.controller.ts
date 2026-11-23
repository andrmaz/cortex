import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { assertAdminOrganizationAccess } from "../guards/assert-admin-organization";
import {
  MAX_QUERY_LOG_LIMIT,
  QueryLogAdminService,
} from "./query-log-admin.service";
import type { QueryLogPageDto } from "./query-log.dto";
import type { AuthenticatedUser } from "../../auth/auth.types";

interface RequestWithUser {
  user: AuthenticatedUser;
}

const isoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

const queryLogQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    userId: z.string().min(1).optional(),
    departmentId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_QUERY_LOG_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "from must be before or equal to to",
  });

@Controller("api/admin/organizations/:organizationId/query-logs")
@UseGuards(AdminRoleGuard)
export class QueryLogsController {
  constructor(private readonly queryLogAdminService: QueryLogAdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Req() req: RequestWithUser,
    @Param("organizationId") organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<QueryLogPageDto> {
    assertAdminOrganizationAccess(req.user.organizationId, organizationId);
    const parsed = queryLogQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    }
    return this.queryLogAdminService.list(organizationId, parsed.data);
  }
}
