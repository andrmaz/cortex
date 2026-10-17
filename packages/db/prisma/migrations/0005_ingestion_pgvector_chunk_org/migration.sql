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
--   ALTER TABLE chunks DROP CONSTRAINT chunks_document_id_organization_id_fkey;
--   ALTER TABLE chunks ADD CONSTRAINT chunks_document_id_fkey
--     FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE ON UPDATE CASCADE;
--   ALTER TABLE documents DROP CONSTRAINT documents_source_id_organization_id_fkey;
--   ALTER TABLE documents ADD CONSTRAINT documents_source_id_fkey
--     FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE ON UPDATE CASCADE;
--   DROP INDEX documents_id_organization_id_key;
--   DROP INDEX sources_id_organization_id_key;
--   Rolling back drops embeddings and ingestion status; re-run ingestion afterwards.
--
-- Data recovery (REQUIRED after applying on a database with existing data):
--   Existing documents get ingestion_status = 'pending' and all chunk embeddings
--   are dropped. No ingestion job exists for these rows, so they must be
--   re-enqueued, e.g. by an admin re-sync of each source. Verify with:
--     SELECT organization_id, source_id, count(*) FROM documents
--     WHERE ingestion_status = 'pending' GROUP BY 1, 2;
--     SELECT count(*) FROM chunks WHERE embedding IS NULL;
--   Both counts should drop to zero once re-ingestion completes.

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

-- Composite FKs guarantee a child row shares its parent's organization.
CREATE UNIQUE INDEX "sources_id_organization_id_key"
ON "sources"("id", "organization_id");

CREATE UNIQUE INDEX "documents_id_organization_id_key"
ON "documents"("id", "organization_id");

ALTER TABLE "documents" DROP CONSTRAINT "documents_source_id_fkey";
ALTER TABLE "documents"
ADD CONSTRAINT "documents_source_id_organization_id_fkey"
FOREIGN KEY ("source_id", "organization_id")
REFERENCES "sources"("id", "organization_id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "chunks" DROP CONSTRAINT "chunks_document_id_fkey";
ALTER TABLE "chunks"
ADD CONSTRAINT "chunks_document_id_organization_id_fkey"
FOREIGN KEY ("document_id", "organization_id")
REFERENCES "documents"("id", "organization_id")
ON DELETE CASCADE
ON UPDATE CASCADE;
