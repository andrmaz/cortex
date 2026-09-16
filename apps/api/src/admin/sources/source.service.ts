import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(SourceService.name);

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
  ): Promise<UploadedDocument> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      throw new NotFoundException(`Source with id "${sourceId}" not found`);
    }

    const document = await this.prisma.document.create({
      data: {
        sourceId,
        organizationId,
        content: file.buffer.toString("utf8"),
        metadata: {
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      },
    });

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
      try {
        await this.prisma.document.delete({ where: { id: document.id } });
      } catch (cleanupError) {
        this.logger.error(
          `Failed to remove document "${document.id}" after enqueue failure`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
      }
      throw new ServiceUnavailableException(
        "Document ingestion queue is unavailable",
        { cause: error },
      );
    }
  }
}
