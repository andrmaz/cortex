import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestionQueueService } from "../../ingestion/ingestion-queue.service";
import { SourceService, type UploadFile } from "./source.service";

const now = new Date("2026-09-16T00:00:00Z");
const source = {
  id: "source-1",
  name: "Handbook",
  type: "upload",
  config: {},
  organizationId: "org-1",
  createdAt: now,
  updatedAt: now,
};
const document = {
  id: "document-1",
  sourceId: source.id,
  organizationId: source.organizationId,
  content: "Hello Cortex",
  metadata: {
    fileName: "handbook.txt",
    mimeType: "text/plain",
    size: 12,
  },
  createdAt: now,
  updatedAt: now,
};
const file: UploadFile = {
  originalname: "handbook.txt",
  mimetype: "text/plain",
  size: 12,
  buffer: Buffer.from("Hello Cortex"),
};

const prisma = {
  source: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  document: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};
const queue = {
  enqueueDocument: jest.fn(),
};

describe("SourceService", () => {
  let service: SourceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceService,
        { provide: PrismaService, useValue: prisma },
        { provide: IngestionQueueService, useValue: queue },
      ],
    }).compile();
    service = module.get(SourceService);
  });

  it("creates a source with explicit organization ownership", async () => {
    prisma.source.create.mockResolvedValue(source);

    await expect(
      service.create("org-1", { name: "Handbook", type: "upload" }),
    ).resolves.toEqual(source);
    expect(prisma.source.create).toHaveBeenCalledWith({
      data: {
        name: "Handbook",
        type: "upload",
        organizationId: "org-1",
      },
    });
  });

  it("creates an org-owned document and enqueues its ingestion job", async () => {
    prisma.source.findUnique.mockResolvedValue(source);
    prisma.document.create.mockResolvedValue(document);
    queue.enqueueDocument.mockResolvedValue("job-1");

    await expect(
      service.uploadDocument("org-1", source.id, file),
    ).resolves.toEqual({ document, jobId: "job-1" });
    expect(prisma.source.findUnique).toHaveBeenCalledWith({
      where: { id: source.id, organizationId: "org-1" },
    });
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        sourceId: source.id,
        organizationId: "org-1",
        content: "Hello Cortex",
        metadata: {
          fileName: "handbook.txt",
          mimeType: "text/plain",
          size: 12,
        },
      },
    });
    expect(queue.enqueueDocument).toHaveBeenCalledWith({
      organizationId: "org-1",
      sourceId: source.id,
      documentId: document.id,
      fileName: "handbook.txt",
      mimeType: "text/plain",
    });
  });

  it("rejects uploads for a source outside the organization scope", async () => {
    prisma.source.findUnique.mockResolvedValue(null);

    await expect(
      service.uploadDocument("org-1", "other-source", file),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.source.findUnique).toHaveBeenCalledWith({
      where: { id: "other-source", organizationId: "org-1" },
    });
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(queue.enqueueDocument).not.toHaveBeenCalled();
  });

  it("reuses an existing document when the idempotency key matches", async () => {
    const existing = {
      ...document,
      metadata: { ...document.metadata, idempotencyKey: "key-1" },
    };
    prisma.source.findUnique.mockResolvedValue(source);
    prisma.document.findFirst.mockResolvedValue(existing);
    queue.enqueueDocument.mockResolvedValue(existing.id);

    await expect(
      service.uploadDocument("org-1", source.id, file, "key-1"),
    ).resolves.toEqual({ document: existing, jobId: existing.id });
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        sourceId: source.id,
        organizationId: "org-1",
        metadata: {
          path: ["idempotencyKey"],
          equals: "key-1",
        },
      },
    });
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(queue.enqueueDocument).toHaveBeenCalledWith({
      organizationId: "org-1",
      sourceId: source.id,
      documentId: existing.id,
      fileName: "handbook.txt",
      mimeType: "text/plain",
    });
  });

  it("preserves the document if enqueueing fails", async () => {
    prisma.source.findUnique.mockResolvedValue(source);
    prisma.document.create.mockResolvedValue(document);
    queue.enqueueDocument.mockRejectedValue(new Error("Redis unavailable"));

    await expect(
      service.uploadDocument("org-1", source.id, file),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });
});
