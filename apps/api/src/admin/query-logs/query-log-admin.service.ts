import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  QueryLogCitationDto,
  QueryLogPageDto,
  QueryLogResponseDto,
} from "./query-log.dto";

export const DEFAULT_QUERY_LOG_LIMIT = 50;
export const MAX_QUERY_LOG_LIMIT = 200;

export interface QueryLogFilters {
  readonly from?: Date;
  readonly to?: Date;
  readonly userId?: string;
  readonly departmentId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

function toCitations(contextBundle: unknown): QueryLogCitationDto[] {
  const citations = (contextBundle as { citations?: unknown } | null)
    ?.citations;
  if (!Array.isArray(citations)) return [];
  // Re-pick the reference fields so stray content can never leak.
  return citations.map((c: QueryLogCitationDto) => ({
    chunkId: c.chunkId,
    documentId: c.documentId,
    sourceId: c.sourceId,
    score: c.score,
  }));
}

type QueryLogRow = Awaited<
  ReturnType<PrismaService["queryLog"]["findMany"]>
>[number] & { user: { email: string } };

function toCreatedAtRange(filters: QueryLogFilters) {
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

function toWhere(organizationId: string, filters: QueryLogFilters) {
  const createdAt = toCreatedAtRange(filters);
  return {
    organizationId,
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
  };
}

function toResponse(
  row: QueryLogRow,
  departmentNames: Map<string, string>,
): QueryLogResponseDto {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actor: { userId: row.userId, email: row.user.email },
    organizationId: row.organizationId,
    department: row.departmentId
      ? {
          id: row.departmentId,
          name: departmentNames.get(row.departmentId) ?? null,
        }
      : null,
    query: row.query,
    policyDecision: row.policyDecision ?? null,
    citations: toCitations(row.contextBundle),
    latencyMs: row.latencyMs,
  };
}

@Injectable()
export class QueryLogAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only, org-scoped audit listing ordered newest first. Fetches one
   * extra row to determine whether another page exists.
   */
  async list(
    organizationId: string,
    filters: QueryLogFilters,
  ): Promise<QueryLogPageDto> {
    await this.assertOrganizationExists(organizationId);

    const limit = Math.min(
      filters.limit ?? DEFAULT_QUERY_LOG_LIMIT,
      MAX_QUERY_LOG_LIMIT,
    );
    const rows = await this.prisma.queryLog.findMany({
      where: toWhere(organizationId, filters),
      include: { user: { select: { email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor } } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const departmentNames = await this.loadDepartmentNames(
      organizationId,
      page,
    );

    return {
      items: page.map((row) => toResponse(row, departmentNames)),
      nextCursor: hasMore ? (rows[limit]?.id ?? null) : null,
    };
  }

  private async assertOrganizationExists(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }
  }

  private async loadDepartmentNames(
    organizationId: string,
    page: readonly QueryLogRow[],
  ): Promise<Map<string, string>> {
    const departmentIds = [
      ...new Set(
        page.flatMap((row) => (row.departmentId ? [row.departmentId] : [])),
      ),
    ];
    if (departmentIds.length === 0) return new Map();
    const departments = await this.prisma.department.findMany({
      where: { organizationId, id: { in: departmentIds } },
      select: { id: true, name: true },
    });
    return new Map(departments.map((d) => [d.id, d.name]));
  }
}
