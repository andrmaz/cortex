import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "db/client";
import {
  createOrgScopedClient,
  getOrgContext,
  isUnscopedContext,
  MissingOrgContextError,
  OrgScopeViolationError,
  Prisma,
  runWithoutOrgScope,
} from "db";
import invariant from "invariant";

const EMBEDDING_WRITE_BATCH_SIZE = 100;

export interface ChunkEmbeddingWrite {
  readonly chunkId: string;
  readonly organizationId: string;
  readonly embedding: readonly number[];
}

export interface ChunkSimilarityRow {
  readonly chunkId: string;
  readonly content: string;
  readonly documentId: string;
  readonly sourceId: string;
  readonly documentMetadata: unknown;
  readonly score: number;
}

function createRawPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  invariant(connectionString, "DATABASE_URL environment variable is required");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Sole application entrypoint to the database.
 *
 * `PrismaService` deliberately does NOT extend `PrismaClient`. Every model
 * delegate exposed below is routed through `createOrgScopedClient`, which
 * enforces organization isolation at the query layer for every operation
 * (see `db`'s `org-scope` module). The raw, unscoped client is a private
 * field with no external accessor — `$queryRaw` / `$executeRaw` are
 * intentionally not re-exported. The scoped client's raw-SQL methods still
 * fail closed unless the caller is inside `runWithoutOrgScope`. There is
 * no way for a consumer to bypass org scoping; it is enforced for every
 * query, not opted into per call site.
 *
 * Code that legitimately needs to query across organizations (e.g.
 * resolving a user's Organization by email domain during login, before the
 * caller's org is known) must wrap the call in `runWithoutOrgScope(...)`
 * from `db`, using the scoped delegates below as normal — the extension
 * recognizes that context and passes the query through unfiltered.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly rawClient = createRawPrismaClient();
  private readonly scoped: PrismaClient = createOrgScopedClient(this.rawClient);

  async onModuleInit(): Promise<void> {
    await this.rawClient.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.rawClient.$disconnect();
  }

  get organization(): PrismaClient["organization"] {
    return this.scoped.organization;
  }

  get user(): PrismaClient["user"] {
    return this.scoped.user;
  }

  get department(): PrismaClient["department"] {
    return this.scoped.department;
  }

  get userDepartment(): PrismaClient["userDepartment"] {
    return this.scoped.userDepartment;
  }

  get source(): PrismaClient["source"] {
    return this.scoped.source;
  }

  get document(): PrismaClient["document"] {
    return this.scoped.document;
  }

  get chunk(): PrismaClient["chunk"] {
    return this.scoped.chunk;
  }

  get policy(): PrismaClient["policy"] {
    return this.scoped.policy;
  }

  get queryLog(): PrismaClient["queryLog"] {
    return this.scoped.queryLog;
  }

  get $transaction(): PrismaClient["$transaction"] {
    return this.scoped.$transaction.bind(this.scoped);
  }

  /**
   * Cosine-similarity search over indexed Chunks of one organization.
   *
   * Raw SQL (pgvector operators are unsupported by Prisma Client) runs in an
   * unscoped context, so isolation is enforced here: the active org context
   * must match `organizationId`, and the query filters on it.
   */
  async searchChunksBySimilarity(params: {
    readonly organizationId: string;
    readonly embedding: readonly number[];
    readonly limit: number;
  }): Promise<ChunkSimilarityRow[]> {
    const { organizationId, embedding, limit } = params;
    invariant(
      embedding.length > 0,
      "query embedding must be a non-empty vector",
    );
    invariant(
      Number.isInteger(limit) && limit > 0,
      "limit must be a positive integer",
    );

    const context = getOrgContext();
    if (!context) {
      throw new MissingOrgContextError("Chunk", "searchChunksBySimilarity");
    }
    if (
      isUnscopedContext(context) ||
      context.organizationId !== organizationId
    ) {
      throw new OrgScopeViolationError("Chunk", "searchChunksBySimilarity");
    }

    const vector = `[${embedding.join(",")}]`;
    return runWithoutOrgScope(() =>
      this.scoped.$queryRaw<ChunkSimilarityRow[]>(Prisma.sql`
        SELECT c."id" AS "chunkId",
               c."content" AS "content",
               c."document_id" AS "documentId",
               d."source_id" AS "sourceId",
               d."metadata" AS "documentMetadata",
               1 - (c."embedding" <=> ${vector}::vector) AS "score"
        FROM "chunks" AS c
        JOIN "documents" AS d
          ON d."id" = c."document_id"
         AND d."organization_id" = c."organization_id"
        WHERE c."organization_id" = ${organizationId}
          AND c."embedding" IS NOT NULL
        ORDER BY c."embedding" <=> ${vector}::vector ASC, c."id" ASC
        LIMIT ${limit}
      `),
    );
  }

  /**
   * Persist pgvector embeddings for Chunks.
   *
   * Prisma cannot write `Unsupported("vector")` through model delegates, so
   * this system path uses raw SQL inside `runWithoutOrgScope` and still
   * constrains every update by `organization_id`.
   */
  async writeChunkEmbeddings(
    rows: readonly ChunkEmbeddingWrite[],
    tx?: Pick<PrismaClient, "$executeRaw">,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    // Only a caller-established unscoped context may span organizations.
    const context = getOrgContext();
    if (!context) {
      throw new MissingOrgContextError("Chunk", "writeChunkEmbeddings");
    }
    const activeOrgId = isUnscopedContext(context)
      ? undefined
      : context.organizationId;

    const seen = new Set<string>();
    for (const row of rows) {
      invariant(
        row.embedding.length > 0,
        "chunk embedding must be a non-empty vector",
      );
      if (activeOrgId !== undefined && row.organizationId !== activeOrgId) {
        throw new OrgScopeViolationError("Chunk", "writeChunkEmbeddings");
      }
      invariant(
        !seen.has(row.chunkId),
        `duplicate embedding write for chunk ${row.chunkId}`,
      );
      seen.add(row.chunkId);
    }

    const client = tx ?? this.scoped;
    await runWithoutOrgScope(async () => {
      for (let i = 0; i < rows.length; i += EMBEDDING_WRITE_BATCH_SIZE) {
        const batch = rows.slice(i, i + EMBEDDING_WRITE_BATCH_SIZE);
        const values = Prisma.join(
          batch.map(
            (row) =>
              Prisma.sql`(${row.chunkId}::text, ${row.organizationId}::text, ${`[${row.embedding.join(",")}]`}::text)`,
          ),
        );
        const updated = await client.$executeRaw(Prisma.sql`
          UPDATE "chunks" AS c
          SET "embedding" = v."embedding"::vector
          FROM (VALUES ${values}) AS v("id", "org", "embedding")
          WHERE c."id" = v."id"
            AND c."organization_id" = v."org"
        `);
        invariant(
          Number(updated) === batch.length,
          `failed to write chunk embeddings: expected ${batch.length} updated rows, got ${Number(updated)}`,
        );
      }
    });
  }
}
