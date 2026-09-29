-- Add a nullable upload idempotency key. PostgreSQL unique indexes treat NULL
-- as distinct, so uploads without a key remain unrestricted.
--
-- The unique index takes a SHARE lock while it validates existing rows. Run it
-- in a maintenance window if documents is large or write-heavy.
--
-- Pre-check: no source has the same non-null key twice.
-- Post-check: documents_organization_id_source_id_idempotency_key_key exists.
-- Rollback: DROP INDEX documents_organization_id_source_id_idempotency_key_key;
--   ALTER TABLE documents DROP COLUMN idempotency_key;

ALTER TABLE "documents" ADD COLUMN "idempotency_key" TEXT;

UPDATE "documents"
SET "idempotency_key" = "metadata"->>'idempotencyKey'
WHERE "metadata"->>'idempotencyKey' IS NOT NULL
  AND "metadata"->>'idempotencyKey' <> '';

CREATE UNIQUE INDEX "documents_organization_id_source_id_idempotency_key_key"
ON "documents"("organization_id", "source_id", "idempotency_key");
