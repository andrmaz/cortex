import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "db/client";
import { createOrgScopedClient, runWithoutOrgScope } from "db";
import invariant from "invariant";

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
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await runWithoutOrgScope(async () => {
      for (const row of rows) {
        invariant(
          row.embedding.length > 0,
          "chunk embedding must be a non-empty vector",
        );
        const vectorLiteral = `[${row.embedding.join(",")}]`;
        const updated = await this.scoped.$executeRaw`
          UPDATE "chunks"
          SET "embedding" = ${vectorLiteral}::vector
          WHERE "id" = ${row.chunkId}
            AND "organization_id" = ${row.organizationId}
        `;
        invariant(
          Number(updated) === 1,
          `failed to write embedding for chunk ${row.chunkId}`,
        );
      }
    });
  }
}
