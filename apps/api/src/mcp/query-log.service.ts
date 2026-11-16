import { Injectable } from "@nestjs/common";
import type { PolicyDecision } from "@cortex/shared/policy";
import { PrismaService } from "../prisma/prisma.service";
import type { ContextBundle } from "./context-bundle.service";
import type { ResolvedScope } from "./identity.service";

export interface QueryLogEntry {
  readonly userId: string;
  readonly scope: ResolvedScope;
  readonly query: string;
  readonly decision: PolicyDecision;
  readonly bundle: ContextBundle;
  readonly latencyMs: number;
}

/**
 * Append-only audit writer. It only creates rows; the underlying
 * `PrismaService.queryLog` exposes no update or delete operations.
 */
@Injectable()
export class QueryLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: QueryLogEntry): Promise<void> {
    const { scope, bundle } = entry;
    await this.prisma.queryLog.create({
      data: {
        userId: entry.userId,
        organizationId: scope.organizationId,
        departmentId: scope.departmentId,
        query: entry.query,
        policyDecision: JSON.parse(JSON.stringify(entry.decision)),
        // References only: never persist chunk content in the audit trail.
        contextBundle: {
          citations: bundle.citations.map((citation) => ({
            chunkId: citation.chunkId,
            documentId: citation.documentId,
            sourceId: citation.sourceId,
            score: citation.score,
          })),
        },
        latencyMs: Math.max(0, Math.round(entry.latencyMs)),
      },
    });
  }
}
