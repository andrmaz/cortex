-- Refuse inconsistent legacy data instead of choosing an arbitrary active version.
CREATE UNIQUE INDEX "policies_one_active_per_department"
ON "policies" ("organization_id", "department_id")
WHERE "is_active" = true;

ALTER TABLE "policies" ALTER COLUMN "is_active" SET DEFAULT false;
