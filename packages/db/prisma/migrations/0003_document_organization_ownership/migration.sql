-- Add explicit tenant ownership to documents while preserving existing rows.
--
-- Production locking: SET NOT NULL, CREATE INDEX, and ADD CONSTRAINT validate
-- existing rows and take ACCESS EXCLUSIVE / SHARE ROW EXCLUSIVE locks on
-- documents (and organizations for the FK). Run during a maintenance window,
-- or split into a staged online migration (nullable column + backfill +
-- NOT VALID constraint / VALIDATE CONSTRAINT / SET NOT NULL) if the table is
-- large or write-heavy.
--
-- Pre-check: SELECT COUNT(*) FROM documents WHERE organization_id IS NULL;
--   must be 0 after the backfill (orphans whose source is gone stay NULL).
-- Post-check: organization_id is NOT NULL and the FK + index exist.
-- Rollback: DROP CONSTRAINT documents_organization_id_fkey;
--   DROP INDEX documents_organization_id_idx;
--   ALTER TABLE documents DROP COLUMN organization_id;
ALTER TABLE "documents" ADD COLUMN "organization_id" TEXT;

UPDATE "documents" AS "document"
SET "organization_id" = "source"."organization_id"
FROM "sources" AS "source"
WHERE "document"."source_id" = "source"."id";

ALTER TABLE "documents" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "documents_organization_id_idx"
ON "documents"("organization_id");

ALTER TABLE "documents"
ADD CONSTRAINT "documents_organization_id_fkey"
FOREIGN KEY ("organization_id")
REFERENCES "organizations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
