-- Enable pgvector and add ingestion status + Chunk organization ownership.
--
-- Requires a Postgres image with the vector extension (e.g. pgvector/pgvector).
-- Rollback:
--   ALTER TABLE chunks DROP COLUMN organization_id;
--   ALTER TABLE chunks DROP COLUMN embedding;
--   ALTER TABLE chunks ADD COLUMN embedding BYTEA;
--   ALTER TABLE documents DROP COLUMN ingestion_error;
--   ALTER TABLE documents DROP COLUMN ingestion_status;
--   DROP EXTENSION IF EXISTS vector;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "documents"
ADD COLUMN "ingestion_status" TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE "documents"
ADD COLUMN "ingestion_error" TEXT;

CREATE INDEX "documents_ingestion_status_idx"
ON "documents"("ingestion_status");

ALTER TABLE "chunks"
ADD COLUMN "organization_id" TEXT;

UPDATE "chunks" AS "chunk"
SET "organization_id" = "document"."organization_id"
FROM "documents" AS "document"
WHERE "chunk"."document_id" = "document"."id";

ALTER TABLE "chunks"
ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "chunks_organization_id_idx"
ON "chunks"("organization_id");

ALTER TABLE "chunks"
ADD CONSTRAINT "chunks_organization_id_fkey"
FOREIGN KEY ("organization_id")
REFERENCES "organizations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "chunks" DROP COLUMN IF EXISTS "embedding";

ALTER TABLE "chunks"
ADD COLUMN "embedding" vector(1536);
