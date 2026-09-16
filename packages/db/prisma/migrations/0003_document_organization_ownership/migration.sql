-- Add explicit tenant ownership to documents while preserving existing rows.
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
