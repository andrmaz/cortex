-- QueryLog audit scope: organization, Primary Department, and latency.
--
-- Rollback:
--   ALTER TABLE "query_logs" DROP CONSTRAINT IF EXISTS "query_logs_user_id_organization_id_fkey";
--   ALTER TABLE "query_logs" DROP CONSTRAINT IF EXISTS "query_logs_organization_id_fkey";
--   DROP INDEX IF EXISTS "query_logs_organization_id_createdAt_idx";
--   ALTER TABLE "query_logs" DROP COLUMN "latency_ms", DROP COLUMN "department_id", DROP COLUMN "organization_id";
--   ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_user_id_fkey"
--     FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
--   (Restrict was used so deleting/re-keying a User or Organization cannot erase or rewrite audit rows.)
--   DROP INDEX IF EXISTS "users_id_organization_id_key";

ALTER TABLE "query_logs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "query_logs" ADD COLUMN "department_id" TEXT;
ALTER TABLE "query_logs" ADD COLUMN "latency_ms" INTEGER;

-- Backfill from the owning user; rows already carry a user_id.
UPDATE "query_logs" AS q
SET "organization_id" = u."organization_id"
FROM "users" AS u
WHERE u."id" = q."user_id";

ALTER TABLE "query_logs" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE UNIQUE INDEX "users_id_organization_id_key" ON "users"("id", "organization_id");

CREATE INDEX "query_logs_organization_id_createdAt_idx"
ON "query_logs"("organization_id", "createdAt");

ALTER TABLE "query_logs" DROP CONSTRAINT "query_logs_user_id_fkey";
ALTER TABLE "query_logs"
ADD CONSTRAINT "query_logs_user_id_organization_id_fkey"
FOREIGN KEY ("user_id", "organization_id")
REFERENCES "users"("id", "organization_id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

ALTER TABLE "query_logs"
ADD CONSTRAINT "query_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;
