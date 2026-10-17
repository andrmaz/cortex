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
