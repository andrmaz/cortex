import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Document, Source } from "db/client";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestionQueueService } from "../../ingestion/ingestion-queue.service";
import type { CreateSourceDto } from "./source.dto";

export interface UploadedDocument {
  document: Document;
  jobId: string;
}

export interface UploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type SourceIngestionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type SourceListItem = Source & {
  ingestionStatus: SourceIngestionStatus;
  ingestionError: string | null;
  completedChunkCount: number;
};

@Injectable()
export class SourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestionQueue: IngestionQueueService,
  ) {}

  async findAll(organizationId: string): Promise<SourceListItem[]> {
    const [sources, activeDocumentIds] = await Promise.all([
      this.prisma.source.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: {
          documents: {
            where: { organizationId },
            select: {
              id: true,
              ingestionStatus: true,
              ingestionError: true,
              _count: { select: { chunks: true } },
            },
          },
        },
      }),
      this.ingestionQueue.getActiveDocumentIds(),
    ]);

    return sources.map((source) => {
      const documents = source.documents;
      const isRunning = (document: (typeof documents)[number]) =>
        activeDocumentIds
          ? activeDocumentIds.has(document.id)
          : document.ingestionStatus === "processing";
      const hasRunningDocument = documents.some(isRunning);
      const failedDocument = documents.find(
        (document) => document.ingestionStatus === "failed",
      );
      const hasPendingDocument = documents.some(
        (document) =>
          document.ingestionStatus !== "completed" &&
          document.ingestionStatus !== "failed" &&
          !isRunning(document),
      );
      const ingestionStatus: SourceIngestionStatus = hasRunningDocument
        ? "running"
        : failedDocument
          ? "failed"
          : hasPendingDocument || documents.length === 0
            ? "pending"
            : "completed";

      return {
        ...source,
        ingestionStatus,
        ingestionError:
          ingestionStatus === "failed"
            ? (failedDocument?.ingestionError ?? null)
            : null,
        completedChunkCount: documents.reduce(
          (count, document) =>
            document.ingestionStatus === "completed"
              ? count + document._count.chunks
              : count,
          0,
        ),
      };
    });
  }

  async create(organizationId: string, dto: CreateSourceDto): Promise<Source> {
    return this.prisma.source.create({
      data: {
        name: dto.name,
        type: dto.type,
        organizationId,
      },
    });
  }

  async uploadDocument(
    organizationId: string,
    sourceId: string,
    file: UploadFile,
    idempotencyKey?: string,
  ): Promise<UploadedDocument> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId, organizationId },
    });
    if (!source) {
      throw new NotFoundException(`Source with id "${sourceId}" not found`);
    }

    const document = await this.findOrCreateDocument(
      organizationId,
      sourceId,
      file,
      idempotencyKey,
    );

    try {
      const jobId = await this.ingestionQueue.enqueueDocument({
        organizationId,
        sourceId,
        documentId: document.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      return { document, jobId };
    } catch (error) {
      // Keep the document: Queue.add can reject after Redis accepted the job.
      // Deleting would leave a queued job pointing at a missing row.
      throw new ServiceUnavailableException(
        "Document ingestion queue is unavailable",
        { cause: error },
      );
    }
  }

  private async findOrCreateDocument(
    organizationId: string,
    sourceId: string,
    file: UploadFile,
    idempotencyKey: string | undefined,
  ): Promise<Document> {
    const content = file.buffer.toString("utf8");
    const existing = await this.findDocumentByIdempotencyKey(
      organizationId,
      sourceId,
      idempotencyKey,
    );
    if (existing) {
      this.assertMatchingUploadContent(existing, content);
      return existing;
    }

    try {
      return await this.prisma.document.create({
        data: {
          sourceId,
          organizationId,
          content,
          ingestionStatus: "pending",
          ingestionError: null,
          metadata: {
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      });
    } catch (error) {
      if (!idempotencyKey || !isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const raced = await this.findDocumentByIdempotencyKey(
        organizationId,
        sourceId,
        idempotencyKey,
      );
      if (!raced) {
        throw error;
      }
      this.assertMatchingUploadContent(raced, content);
      return raced;
    }
  }

  private assertMatchingUploadContent(
    document: Document,
    content: string,
  ): void {
    if (document.content !== content) {
      throw new ConflictException(
        "Idempotency key has already been used for different file content",
      );
    }
  }

  private async findDocumentByIdempotencyKey(
    organizationId: string,
    sourceId: string,
    idempotencyKey: string | undefined,
  ): Promise<Document | null> {
    if (!idempotencyKey) {
      return null;
    }

    return this.prisma.document.findFirst({
      where: {
        sourceId,
        organizationId,
        idempotencyKey,
      },
    });
  }
}
