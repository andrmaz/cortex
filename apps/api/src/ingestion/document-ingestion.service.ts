import { Inject, Injectable } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import { runWithOrgContext } from "db";
import { PrismaService } from "../prisma/prisma.service";
import {
  EMBEDDING_PROVIDER,
  EmbeddingProviderError,
  type EmbeddingProvider,
} from "./embedding.provider";
import type { IngestDocumentJobData } from "./ingestion-queue.service";
import { chunkDocumentContent } from "./text-chunker";

export { EmbeddingProviderError } from "./embedding.provider";

/** Upper bound on chunks per Document, checked before any embedding allocation. */
export const MAX_CHUNKS_PER_DOCUMENT = 2_000;

export type IngestionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

@Injectable()
export class DocumentIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddings: EmbeddingProvider,
  ) {}

  async process(job: IngestDocumentJobData): Promise<void> {
    await runWithOrgContext(job.organizationId, async () => {
      await this.markStatus(job.documentId, "processing", null);

      try {
        const document = await this.prisma.document.findUnique({
          where: { id: job.documentId },
        });
        if (!document) {
          throw new Error(`Document "${job.documentId}" was not found`);
        }

        const texts = chunkDocumentContent(document.content);
        // Embed before any write so a provider failure keeps prior chunks.
        const vectors =
          texts.length === 0 ? [] : await this.embeddings.embedMany(texts);
        if (vectors.length !== texts.length) {
          throw new EmbeddingProviderError(
            `Embedding provider returned ${vectors.length} vectors for ${texts.length} chunks`,
          );
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.chunk.deleteMany({ where: { documentId: job.documentId } });
          if (texts.length === 0) {
            return;
          }

          await tx.chunk.createMany({
            data: texts.map((content, index) => ({
              documentId: job.documentId,
              organizationId: job.organizationId,
              content,
              metadata: { index },
            })),
          });

          const created = await tx.chunk.findMany({
            where: { documentId: job.documentId },
            select: { id: true, organizationId: true, metadata: true },
          });
          const chunks = [...created].sort(
            (left, right) =>
              chunkIndex(left.metadata) - chunkIndex(right.metadata),
          );

          await this.prisma.writeChunkEmbeddings(
            chunks.map((chunk, index) => ({
              chunkId: chunk.id,
              organizationId: chunk.organizationId,
              embedding: vectors[index] ?? [],
            })),
            tx,
          );
        }, { timeout: 30_000, maxWait: 10_000 });

        await this.markStatus(job.documentId, "completed", null);
      } catch (error) {
        const reason = actionableErrorMessage(error);
        await this.markStatus(job.documentId, "failed", reason);
        throw error;
      }
    });
  }

  private async markStatus(
    documentId: string,
    ingestionStatus: IngestionStatus,
    ingestionError: string | null,
  ): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { ingestionStatus, ingestionError },
    });
  }
}

function actionableErrorMessage(error: unknown): string {
  if (error instanceof EmbeddingProviderError) {
    return error.message;
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message.slice(0, 1_000);
  }
  return "Document ingestion failed";
}

function chunkIndex(metadata: unknown): number {
  if (
    metadata !== null &&
    typeof metadata === "object" &&
    "index" in metadata &&
    typeof metadata.index === "number"
  ) {
    return metadata.index;
  }
  return 0;
}
