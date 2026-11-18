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
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(
        `Organization with id "${organizationId}" not found`,
      );
    }

    const limit = Math.min(
      filters.limit ?? DEFAULT_QUERY_LOG_LIMIT,
      MAX_QUERY_LOG_LIMIT,
    );
    const createdAt =
      filters.from || filters.to
        ? {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          }
        : undefined;

    const rows = await this.prisma.queryLog.findMany({
      where: {
        organizationId,
        ...(createdAt ? { createdAt } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      include: { user: { select: { email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor } } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const departmentIds = [
      ...new Set(
        page.flatMap((row) => (row.departmentId ? [row.departmentId] : [])),
      ),
    ];
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: { organizationId, id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
    const departmentNames = new Map(departments.map((d) => [d.id, d.name]));

    const items: QueryLogResponseDto[] = page.map((row) => ({
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
    }));

    return { items, nextCursor: hasMore ? (rows[limit]?.id ?? null) : null };
  }
}
