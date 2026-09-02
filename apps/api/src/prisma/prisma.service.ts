import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "db/client";
import { createOrgScopedClient } from "db";

function createRawPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
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
 * field with no external accessor, so there is no way for a consumer to
 * bypass org scoping — it is enforced for every query, not opted into per
 * call site.
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
}
