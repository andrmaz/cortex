import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Document, Source } from "db/client";
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

@Injectable()
export class SourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestionQueue: IngestionQueueService,
  ) {}

  async findAll(organizationId: string): Promise<Source[]> {
    return this.prisma.source.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
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

    const document =
      (await this.findDocumentByIdempotencyKey(
        organizationId,
        sourceId,
        idempotencyKey,
      )) ??
      (await this.prisma.document.create({
        data: {
          sourceId,
          organizationId,
          content: file.buffer.toString("utf8"),
          metadata: {
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        },
      }));

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
        metadata: {
          path: ["idempotencyKey"],
          equals: idempotencyKey,
        },
      },
    });
  }
}
