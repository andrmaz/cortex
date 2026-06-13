-- Add unique constraint to organizations.name
-- Domain-based org lookup in user provisioning requires unambiguous resolution.

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");
