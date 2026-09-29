-- Persist upload idempotency keys so concurrent retries cannot insert two documents.
--
-- PostgreSQL UNIQUE treats NULL as distinct, so documents uploaded without a
-- key are not constrained by this index.
--
-- Locking: ADD COLUMN of a nullable column with no table-rewriting default is
-- metadata-only. The backfill updates only rows that already stored a key in
-- metadata. CREATE UNIQUE INDEX takes SHARE ROW EXCLUSIVE and validates rows.
--
-- Pre-check: no duplicate non-null metadata keys within one organization and
-- source, or the unique index creation fails:
--   SELECT organization_id, source_id, metadata->>'idempotencyKey', COUNT(*)
--   FROM documents
--   WHERE metadata->>'idempotencyKey' IS NOT NULL
--   GROUP BY 1, 2, 3
--   HAVING COUNT(*) > 1;
-- Post-check: documents.idempotency_key exists and
--   documents_organization_id_source_id_idempotency_key_key is unique.
-- Rollback: DROP INDEX "documents_organization_id_source_id_idempotency_key_key";
--   ALTER TABLE "documents" DROP COLUMN "idempotency_key";
ALTER TABLE "documents" ADD COLUMN "idempotency_key" TEXT;

UPDATE "documents"
SET "idempotency_key" = "metadata"->>'idempotencyKey'
WHERE "metadata"->>'idempotencyKey' IS NOT NULL
  AND "idempotency_key" IS NULL;

CREATE UNIQUE INDEX "documents_organization_id_source_id_idempotency_key_key"
ON "documents"("organization_id", "source_id", "idempotency_key");
