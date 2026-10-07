-- Add a nullable upload idempotency key. PostgreSQL unique indexes treat NULL
-- as distinct, so uploads without a key remain unrestricted.
--
-- The unique index takes a SHARE lock while it validates existing rows. Run it
-- in a maintenance window if documents is large or write-heavy.
--
-- Duplicate non-empty legacy keys are kept on the first document ordered by id;
-- remaining documents receive a distinct suffix before the unique index exists.
-- Post-check: documents_organization_id_source_id_idempotency_key_key exists.
-- Rollback: DROP INDEX documents_organization_id_source_id_idempotency_key_key;
--   ALTER TABLE documents DROP COLUMN idempotency_key;

ALTER TABLE "documents" ADD COLUMN "idempotency_key" TEXT;

UPDATE "documents"
SET "idempotency_key" = "metadata"->>'idempotencyKey'
WHERE "metadata"->>'idempotencyKey' IS NOT NULL
  AND "metadata"->>'idempotencyKey' <> '';

DO $$
DECLARE
    duplicate_document RECORD;
    candidate_key TEXT;
    collision_suffix INTEGER;
BEGIN
    FOR duplicate_document IN
        SELECT "id", "organization_id", "source_id", "idempotency_key"
        FROM (
            SELECT
                "id",
                "organization_id",
                "source_id",
                "idempotency_key",
                ROW_NUMBER() OVER (
                    PARTITION BY
                        "organization_id",
                        "source_id",
                        "idempotency_key"
                    ORDER BY "id"
                ) AS duplicate_number
            FROM "documents"
            WHERE "idempotency_key" IS NOT NULL
              AND "idempotency_key" <> ''
        ) AS ranked_documents
        WHERE duplicate_number > 1
    LOOP
        candidate_key :=
            duplicate_document.idempotency_key || ':' || duplicate_document.id;
        collision_suffix := 0;

        WHILE EXISTS (
            SELECT 1
            FROM "documents"
            WHERE "organization_id" = duplicate_document.organization_id
              AND "source_id" = duplicate_document.source_id
              AND "idempotency_key" = candidate_key
              AND "id" <> duplicate_document.id
        ) LOOP
            collision_suffix := collision_suffix + 1;
            candidate_key :=
                duplicate_document.idempotency_key
                || ':'
                || duplicate_document.id
                || ':'
                || collision_suffix;
        END LOOP;

        UPDATE "documents"
        SET "idempotency_key" = candidate_key
        WHERE "id" = duplicate_document.id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX "documents_organization_id_source_id_idempotency_key_key"
ON "documents"("organization_id", "source_id", "idempotency_key");
