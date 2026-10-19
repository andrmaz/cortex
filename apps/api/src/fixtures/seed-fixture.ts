import { NestFactory } from "@nestjs/core";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { GOOGLE_ORG_FIXTURE, seedGoogleOrgFixture } from "./google-org-fixture";

async function main(): Promise<void> {
  if (
    process.env["CORTEX_DEV_LOGIN"] !== "true" ||
    process.env["NODE_ENV"] === "production"
  ) {
    throw new Error(
      "seed:fixture requires CORTEX_DEV_LOGIN=true and a non-production NODE_ENV",
    );
  }
  const app = await NestFactory.createApplicationContext(PrismaModule, {
    logger: ["error"],
  });
  try {
    const { organizationId } = await seedGoogleOrgFixture(
      app.get(PrismaService),
    );
    console.log(
      `Seeded fixture organization ${GOOGLE_ORG_FIXTURE.organizationName} (${organizationId}); admin: ${GOOGLE_ORG_FIXTURE.adminEmail}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
