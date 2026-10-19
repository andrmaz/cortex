import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { fromPartial } from "@total-typescript/shoehorn";
import type { Document } from "db";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentIngestionService } from "./document-ingestion.service";
import {
  DeterministicEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from "./embedding.provider";
import { IngestionQueueService } from "./ingestion-queue.service";
import { SourceService } from "../admin/sources/source.service";

/**
 * Happy-path seam: upload enqueues a job, then the worker processor indexes
 * Chunks with org ownership and embeddings — without requiring Redis.
 */
describe("Ingestion happy path (upload → job → indexed chunks)", () => {
  it("indexes chunks after an upload-enqueued job is processed", async () => {
    const now = new Date("2026-10-14T00:00:00Z");
    const document = fromPartial<Document>({
      id: "document-1",
      sourceId: "source-1",
      organizationId: "org-1",
      content: "First section.\n\nSecond section about policies.",
      metadata: {
        fileName: "handbook.txt",
        mimeType: "text/plain",
        size: 42,
      },
      ingestionStatus: "pending",
      ingestionError: null,
      createdAt: now,
      updatedAt: now,
    });

    const storedChunks: Array<{
      id: string;
      documentId: string;
      organizationId: string;
      content: string;
      metadata: { index: number };
    }> = [];
    let status = "pending";
    let error: string | null = null;
    let embeddingsWritten: unknown;

    const prisma = {
      source: {
        findUnique: vi.fn().mockResolvedValue({
          id: "source-1",
          organizationId: "org-1",
          name: "Handbook",
          type: "upload",
        }),
      },
      document: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          ...document,
          ...data,
        })),
        findUnique: vi.fn().mockImplementation(async () => ({
          ...document,
          content: "First section.\n\nSecond section about policies.",
          ingestionStatus: status,
          ingestionError: error,
        })),
        update: vi.fn().mockImplementation(async ({ data }) => {
          status = data.ingestionStatus;
          error = data.ingestionError;
          return {
            ...document,
            ingestionStatus: status,
            ingestionError: error,
          };
        }),
      },
      chunk: {
        deleteMany: vi.fn().mockImplementation(async () => {
          storedChunks.length = 0;
          return { count: 0 };
        }),
        createMany: vi.fn().mockImplementation(async ({ data }) => {
          for (const row of data) {
            storedChunks.push({
              id: `chunk-${row.metadata.index}`,
              documentId: row.documentId,
              organizationId: row.organizationId,
              content: row.content,
              metadata: row.metadata,
            });
          }
          return { count: data.length };
        }),
        findMany: vi.fn().mockImplementation(async () => storedChunks),
      },
      writeChunkEmbeddings: vi.fn().mockImplementation(async (rows) => {
        embeddingsWritten = rows;
      }),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(prisma),
    );

    const queue = {
      enqueueDocument: vi.fn().mockResolvedValue("document-1"),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SourceService,
        DocumentIngestionService,
        { provide: PrismaService, useValue: prisma },
        { provide: IngestionQueueService, useValue: queue },
        {
          provide: EMBEDDING_PROVIDER,
          useClass: DeterministicEmbeddingProvider,
        },
      ],
    }).compile();

    const sources = moduleRef.get(SourceService);
    const ingestion = moduleRef.get(DocumentIngestionService);

    const uploaded = await sources.uploadDocument("org-1", "source-1", {
      originalname: "handbook.txt",
      mimetype: "text/plain",
      size: 42,
      buffer: Buffer.from("First section.\n\nSecond section about policies."),
    });

    expect(uploaded.jobId).toBe("document-1");
    expect(queue.enqueueDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        documentId: uploaded.document.id,
      }),
    );

    await ingestion.process({
      organizationId: "org-1",
      sourceId: "source-1",
      documentId: uploaded.document.id,
      fileName: "handbook.txt",
      mimeType: "text/plain",
    });

    expect(status).toBe("completed");
    expect(error).toBeNull();
    expect(storedChunks).toEqual([
      expect.objectContaining({
        organizationId: "org-1",
        content: "First section.",
      }),
      expect.objectContaining({
        organizationId: "org-1",
        content: "Second section about policies.",
      }),
    ]);
    expect(embeddingsWritten).toEqual([
      expect.objectContaining({
        chunkId: "chunk-0",
        organizationId: "org-1",
        embedding: expect.any(Array),
      }),
      expect.objectContaining({
        chunkId: "chunk-1",
        organizationId: "org-1",
        embedding: expect.any(Array),
      }),
    ]);
    expect(
      (embeddingsWritten as Array<{ embedding: number[] }>)[0]?.embedding,
    ).toHaveLength(1536);
  });
});
