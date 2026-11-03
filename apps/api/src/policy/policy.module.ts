import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { PolicyRuntimeService } from "./policy-runtime.service";

@Module({
  imports: [PrismaModule, RetrievalModule],
  providers: [PolicyRuntimeService],
  exports: [PolicyRuntimeService],
})
export class PolicyModule {}
