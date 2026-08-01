import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationService } from "./organizations/organization.service";

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [OrganizationService],
})
export class AdminModule {}
