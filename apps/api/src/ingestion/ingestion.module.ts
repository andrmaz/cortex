import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DocumentIngestionService } from "./document-ingestion.service";
import {
  createEmbeddingProviderFromEnv,
  EMBEDDING_PROVIDER,
} from "./embedding.provider";
import { IngestionQueueService } from "./ingestion-queue.service";
import { IngestionWorker } from "./ingestion.worker";

@Module({
  imports: [PrismaModule],
  providers: [
    IngestionQueueService,
    DocumentIngestionService,
    IngestionWorker,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => createEmbeddingProviderFromEnv(),
    },
  ],
  exports: [IngestionQueueService, DocumentIngestionService],
})
export class IngestionModule {}
