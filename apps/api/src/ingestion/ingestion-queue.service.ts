import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const INGESTION_QUEUE_NAME = "document-ingestion";
export const INGEST_DOCUMENT_JOB_NAME = "ingest-document";
export const FAILED_JOB_RETENTION_AGE_SECONDS = 7 * 24 * 60 * 60;
export const FAILED_JOB_RETENTION_COUNT = 1_000;

export interface IngestDocumentJobData {
  organizationId: string;
  sourceId: string;
  documentId: string;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class IngestionQueueService implements OnModuleDestroy {
  private queue?: Queue<IngestDocumentJobData>;

  private getQueue(): Queue<IngestDocumentJobData> {
    this.queue ??= new Queue<IngestDocumentJobData>(INGESTION_QUEUE_NAME, {
      connection: {
        url: process.env["REDIS_URL"] ?? "redis://localhost:6379",
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: {
          age: FAILED_JOB_RETENTION_AGE_SECONDS,
          count: FAILED_JOB_RETENTION_COUNT,
        },
      },
    });
    return this.queue;
  }

  async enqueueDocument(data: IngestDocumentJobData): Promise<string> {
    const jobId = data.documentId;
    try {
      const job = await this.getQueue().add(INGEST_DOCUMENT_JOB_NAME, data, {
        jobId,
      });
      if (job.id === undefined) {
        throw new Error("BullMQ did not assign an ingestion job id");
      }
      return job.id;
    } catch (error) {
      const existing = await this.findQueuedJob(jobId);
      if (existing !== undefined) {
        return existing;
      }
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  private async findQueuedJob(jobId: string): Promise<string | undefined> {
    try {
      const existing = await this.getQueue().getJob(jobId);
      return existing?.id;
    } catch {
      return undefined;
    }
  }
}
