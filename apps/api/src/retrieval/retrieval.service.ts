import { Inject, Injectable } from "@nestjs/common";
import { runWithOrgContext } from "db";
import {
  EMBEDDING_PROVIDER,
  EmbeddingProviderError,
  type EmbeddingProvider,
} from "../ingestion/embedding.provider";
import { PrismaService } from "../prisma/prisma.service";

export const DEFAULT_TOP_K = 5;
export const MAX_TOP_K = 50;

export interface RetrievedChunk {
  readonly chunkId: string;
  readonly content: string;
  readonly score: number;
  readonly sourceRef: {
    readonly sourceId: string;
    readonly documentId: string;
    readonly fileName?: string;
  };
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddings: EmbeddingProvider,
  ) {}

  /** Returns the top-k chunks most similar to `query`, from `organizationId` only. */
  async search(
    query: string,
    organizationId: string,
    topK: number = DEFAULT_TOP_K,
  ): Promise<RetrievedChunk[]> {
    const text = query.trim();
    if (text.length === 0) {
      throw new Error("query must not be empty");
    }
    const limit = Math.min(Math.max(Math.floor(topK), 1), MAX_TOP_K);

    const [embedding] = await this.embeddings.embedMany([text]);
    if (!embedding) {
      throw new EmbeddingProviderError(
        "Embedding provider returned no vector for the query",
      );
    }

    return runWithOrgContext(organizationId, async () => {
      const rows = await this.prisma.searchChunksBySimilarity({
        organizationId,
        embedding,
        limit,
      });
      return rows.map((row) => {
        const fileName = fileNameOf(row.documentMetadata);
        return {
          chunkId: row.chunkId,
          content: row.content,
          score: Number(row.score),
          sourceRef: {
            sourceId: row.sourceId,
            documentId: row.documentId,
            ...(fileName ? { fileName } : {}),
          },
        };
      });
    });
  }
}

function fileNameOf(metadata: unknown): string | undefined {
  if (
    metadata !== null &&
    typeof metadata === "object" &&
    "fileName" in metadata &&
    typeof metadata.fileName === "string"
  ) {
    return metadata.fileName;
  }
  return undefined;
}
