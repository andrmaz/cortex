-- New policy versions require explicit activation.
ALTER TABLE "policies" ALTER COLUMN "is_active" SET DEFAULT false;

-- A department may have zero or one active policy version.
CREATE UNIQUE INDEX "policies_one_active_per_department_key"
ON "policies"("organization_id", "department_id")
WHERE "is_active" = true;
