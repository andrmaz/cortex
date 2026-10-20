import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prismaDir = join(__dirname, "..", "..", "prisma");
const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    prismaDir,
    "migrations",
    "0006_composite_org_foreign_keys",
    "migration.sql",
  ),
  "utf8",
);

// Chunk and Document use direct org scope, so cross-org parent references
// must be rejected by the database via composite foreign keys.
describe("composite org foreign keys for direct-scoped models", () => {
  it("models the composite relations in schema.prisma", () => {
    expect(schema).toContain(
      "fields: [documentId, organizationId], references: [id, organizationId]",
    );
    expect(schema).toContain(
      "fields: [sourceId, organizationId], references: [id, organizationId]",
    );
    expect(schema.match(/@@unique\(\[id, organizationId\]\)/g)).toHaveLength(2);
  });

  it("creates matching unique indexes and composite FKs in the migration", () => {
    expect(migration).toContain('"sources"("id", "organization_id")');
    expect(migration).toContain('"documents"("id", "organization_id")');
    expect(migration).toContain('FOREIGN KEY ("source_id", "organization_id")');
    expect(migration).toContain(
      'FOREIGN KEY ("document_id", "organization_id")',
    );
  });

  it("documents a rollback that drops constraints before the org column", () => {
    const rollback = migration.slice(
      migration.indexOf("-- Rollback"),
      migration.indexOf("-- Data recovery"),
    );
    const dropFk = rollback.indexOf(
      "DROP CONSTRAINT IF EXISTS chunks_document",
    );
    const dropIndex = rollback.indexOf("DROP INDEX IF EXISTS documents_id");
    expect(dropFk).toBeGreaterThan(-1);
    expect(dropIndex).toBeGreaterThan(dropFk);
  });

  it("preflights cross-organization rows before adding the FKs", () => {
    expect(migration.indexOf("RAISE EXCEPTION")).toBeGreaterThan(-1);
    expect(migration.indexOf("RAISE EXCEPTION")).toBeLessThan(
      migration.indexOf("CREATE UNIQUE INDEX"),
    );
  });
});
