import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Job, Worker } from "bullmq";
import { DocumentIngestionService } from "./document-ingestion.service";
import {
  INGEST_DOCUMENT_JOB_NAME,
  INGESTION_QUEUE_NAME,
  type IngestDocumentJobData,
} from "./ingestion-queue.service";

/**
 * BullMQ consumer for document-ingestion jobs.
 *
 * Disabled automatically under Jest (`JEST_WORKER_ID`) and when
 * `INGESTION_WORKER_ENABLED=false`, so unit/integration suites do not open
 * Redis connections.
 */
@Injectable()
export class IngestionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionWorker.name);
  private worker?: Worker<IngestDocumentJobData>;

  constructor(private readonly ingestion: DocumentIngestionService) {}

  onModuleInit(): void {
    if (!shouldStartWorker()) {
      this.logger.log("Ingestion worker not started (disabled for this process)");
      return;
    }

    this.worker = new Worker<IngestDocumentJobData>(
      INGESTION_QUEUE_NAME,
      async (job: Job<IngestDocumentJobData>) => {
        if (job.name !== INGEST_DOCUMENT_JOB_NAME) {
          this.logger.warn(`Ignoring unexpected job name "${job.name}"`);
          return;
        }
        await this.ingestion.process(job.data);
      },
      {
        connection: {
          url: process.env["REDIS_URL"] ?? "redis://localhost:6379",
          maxRetriesPerRequest: null,
        },
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Ingestion job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

function shouldStartWorker(): boolean {
  if (process.env["JEST_WORKER_ID"] !== undefined) {
    return false;
  }
  return process.env["INGESTION_WORKER_ENABLED"] !== "false";
}
