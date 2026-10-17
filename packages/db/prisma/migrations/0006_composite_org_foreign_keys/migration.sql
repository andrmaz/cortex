-- Composite FKs guarantee a child row shares its parent's organization.
--
-- Rollback (constraints first: dropping a column silently drops the composite FK on it):
--   ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_organization_id_fkey;
--   ALTER TABLE chunks ADD CONSTRAINT chunks_document_id_fkey
--     FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE ON UPDATE CASCADE;
--   ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_id_organization_id_fkey;
--   ALTER TABLE documents ADD CONSTRAINT documents_source_id_fkey
--     FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE ON UPDATE CASCADE;
--   DROP INDEX IF EXISTS documents_id_organization_id_key;
--   DROP INDEX IF EXISTS sources_id_organization_id_key;
--
-- Data recovery (REQUIRED after 0005 on a database with existing data):
--   0005 sets existing documents to ingestion_status = 'pending' and drops all
--   chunk embeddings. No ingestion job exists for these rows, so they must be
--   re-enqueued. Verify with:
--     SELECT organization_id, source_id, count(*) FROM documents
--     WHERE ingestion_status = 'pending' GROUP BY 1, 2;
--     SELECT count(*) FROM chunks WHERE embedding IS NULL;
--   Both counts should drop to zero once re-ingestion completes.

-- Preflight: fail with an actionable message instead of a bare FK violation.
DO $$
DECLARE
  mismatched_documents integer;
  mismatched_chunks integer;
BEGIN
  SELECT count(*) INTO mismatched_documents
  FROM "documents" AS "d"
  JOIN "sources" AS "s" ON "s"."id" = "d"."source_id"
  WHERE "s"."organization_id" <> "d"."organization_id";

  SELECT count(*) INTO mismatched_chunks
  FROM "chunks" AS "c"
  JOIN "documents" AS "d" ON "d"."id" = "c"."document_id"
  WHERE "d"."organization_id" <> "c"."organization_id";

  IF mismatched_documents > 0 OR mismatched_chunks > 0 THEN
    RAISE EXCEPTION
      'Cross-organization rows block composite FKs: % documents with a source in another organization, % chunks with a document in another organization. Repair or delete them, then re-run.',
      mismatched_documents, mismatched_chunks;
  END IF;
END
$$;

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
