import { Module } from "@nestjs/common";
import {
  createEmbeddingProviderFromEnv,
  EMBEDDING_PROVIDER,
} from "../ingestion/embedding.provider";
import { PrismaModule } from "../prisma/prisma.module";
import { RetrievalService } from "./retrieval.service";

@Module({
  imports: [PrismaModule],
  providers: [
    RetrievalService,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => createEmbeddingProviderFromEnv(),
    },
  ],
  exports: [RetrievalService],
})
export class RetrievalModule {}
