import { fromPartial } from "@total-typescript/shoehorn";
import type { Document } from "db";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentIngestionService } from "./document-ingestion.service";
import {
  EmbeddingProviderError,
  type EmbeddingProvider,
} from "./embedding.provider";
import type { IngestDocumentJobData } from "./ingestion-queue.service";

const job: IngestDocumentJobData = {
  organizationId: "org-1",
  sourceId: "source-1",
  documentId: "document-1",
  fileName: "handbook.txt",
  mimeType: "text/plain",
};

const document = fromPartial<Document>({
  id: "document-1",
  sourceId: "source-1",
  organizationId: "org-1",
  content: "Alpha paragraph.\n\nBeta paragraph about Cortex retrieval.",
  metadata: {},
  ingestionStatus: "pending",
  ingestionError: null,
});

function createPrisma() {
  const prisma = {
    document: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chunk: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    writeChunkEmbeddings: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return prisma;
}

describe("DocumentIngestionService", () => {
  it("indexes chunks with org ownership and embeddings on the happy path", async () => {
    const prisma = createPrisma();
    prisma.document.findUnique.mockResolvedValue(document);
    prisma.document.update.mockResolvedValue(document);
    prisma.chunk.deleteMany.mockResolvedValue({ count: 0 });
    prisma.chunk.createMany.mockResolvedValue({ count: 2 });
    prisma.chunk.findMany.mockResolvedValue([
      { id: "chunk-1", content: "Alpha paragraph.", organizationId: "org-1" },
      {
        id: "chunk-2",
        content: "Beta paragraph about Cortex retrieval.",
        organizationId: "org-1",
      },
    ]);
    prisma.writeChunkEmbeddings.mockResolvedValue(undefined);

    const embeddingProvider: EmbeddingProvider = {
      embedMany: jest.fn().mockResolvedValue([
        Array.from({ length: 1536 }, (_, i) => i * 0.001),
        Array.from({ length: 1536 }, (_, i) => i * 0.002),
      ]),
    };

    const service = new DocumentIngestionService(
      prisma as unknown as PrismaService,
      embeddingProvider,
    );

    await service.process(job);

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: job.documentId },
      data: { ingestionStatus: "processing", ingestionError: null },
    });
    expect(prisma.chunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: job.documentId },
    });
    expect(prisma.chunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: job.documentId,
          organizationId: job.organizationId,
          content: "Alpha paragraph.",
          metadata: { index: 0 },
        },
        {
          documentId: job.documentId,
          organizationId: job.organizationId,
          content: "Beta paragraph about Cortex retrieval.",
          metadata: { index: 1 },
        },
      ],
    });
    expect(embeddingProvider.embedMany).toHaveBeenCalledWith([
      "Alpha paragraph.",
      "Beta paragraph about Cortex retrieval.",
    ]);
    expect(prisma.writeChunkEmbeddings).toHaveBeenCalledWith([
      {
        chunkId: "chunk-1",
        organizationId: "org-1",
        embedding: expect.any(Array),
      },
      {
        chunkId: "chunk-2",
        organizationId: "org-1",
        embedding: expect.any(Array),
      },
    ], prisma);
    expect(prisma.document.update).toHaveBeenLastCalledWith({
      where: { id: job.documentId },
      data: { ingestionStatus: "completed", ingestionError: null },
    });
  });

  it("surfaces an actionable Document error when the embedding provider fails", async () => {
    const prisma = createPrisma();
    prisma.document.findUnique.mockResolvedValue(document);
    prisma.document.update.mockResolvedValue(document);
    prisma.chunk.deleteMany.mockResolvedValue({ count: 0 });
    prisma.chunk.createMany.mockResolvedValue({ count: 1 });
    prisma.chunk.findMany.mockResolvedValue([
      { id: "chunk-1", content: "Alpha paragraph.", organizationId: "org-1" },
    ]);

    const embeddingProvider: EmbeddingProvider = {
      embedMany: jest
        .fn()
        .mockRejectedValue(new EmbeddingProviderError("OpenAI 429: rate limited")),
    };

    const service = new DocumentIngestionService(
      prisma as unknown as PrismaService,
      embeddingProvider,
    );

    await expect(service.process(job)).rejects.toThrow(EmbeddingProviderError);

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: job.documentId },
      data: {
        ingestionStatus: "failed",
        ingestionError: "OpenAI 429: rate limited",
      },
    });
    expect(prisma.writeChunkEmbeddings).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.chunk.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes old chunks and completes when content is empty", async () => {
    const prisma = createPrisma();
    prisma.document.findUnique.mockResolvedValue({ ...document, content: "" });
    prisma.document.update.mockResolvedValue(document);
    prisma.chunk.deleteMany.mockResolvedValue({ count: 3 });
    const embeddingProvider: EmbeddingProvider = { embedMany: jest.fn() };

    const service = new DocumentIngestionService(
      prisma as unknown as PrismaService,
      embeddingProvider,
    );
    await service.process(job);

    expect(embeddingProvider.embedMany).not.toHaveBeenCalled();
    expect(prisma.chunk.deleteMany).toHaveBeenCalled();
    expect(prisma.chunk.createMany).not.toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenLastCalledWith({
      where: { id: job.documentId },
      data: { ingestionStatus: "completed", ingestionError: null },
    });
  });
});
