import { Queue } from "bullmq";
import {
  FAILED_JOB_RETENTION_AGE_SECONDS,
  FAILED_JOB_RETENTION_COUNT,
  INGEST_DOCUMENT_JOB_NAME,
  INGESTION_QUEUE_NAME,
  IngestionQueueService,
  type IngestDocumentJobData,
} from "./ingestion-queue.service";

const add = jest.fn();
const close = jest.fn();
const getJob = jest.fn();

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({ add, close, getJob })),
}));

const data: IngestDocumentJobData = {
  organizationId: "org-1",
  sourceId: "source-1",
  documentId: "document-1",
  fileName: "handbook.txt",
  mimeType: "text/plain",
};

describe("IngestionQueueService", () => {
  const previousRedisUrl = process.env["REDIS_URL"];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env["REDIS_URL"] = "redis://queue.example:6379";
  });

  afterAll(() => {
    if (previousRedisUrl === undefined) {
      delete process.env["REDIS_URL"];
    } else {
      process.env["REDIS_URL"] = previousRedisUrl;
    }
  });

  it("adds document ingestion jobs to the configured BullMQ queue", async () => {
    add.mockResolvedValue({ id: data.documentId });
    const service = new IngestionQueueService();

    await expect(service.enqueueDocument(data)).resolves.toBe(data.documentId);
    expect(Queue).toHaveBeenCalledWith(
      INGESTION_QUEUE_NAME,
      expect.objectContaining({
        connection: { url: "redis://queue.example:6379" },
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          removeOnFail: {
            age: FAILED_JOB_RETENTION_AGE_SECONDS,
            count: FAILED_JOB_RETENTION_COUNT,
          },
        }),
      }),
    );
    expect(add).toHaveBeenCalledWith(INGEST_DOCUMENT_JOB_NAME, data, {
      jobId: data.documentId,
    });
    expect(getJob).not.toHaveBeenCalled();
  });

  it("returns an existing job when add fails after Redis accepted it", async () => {
    add.mockRejectedValue(new Error("lost acknowledgement"));
    getJob.mockResolvedValue({ id: data.documentId });
    const service = new IngestionQueueService();

    await expect(service.enqueueDocument(data)).resolves.toBe(data.documentId);
    expect(getJob).toHaveBeenCalledWith(data.documentId);
  });

  it("rethrows when add fails and the job is not in the queue", async () => {
    const failure = new Error("Redis unavailable");
    add.mockRejectedValue(failure);
    getJob.mockResolvedValue(undefined);
    const service = new IngestionQueueService();

    await expect(service.enqueueDocument(data)).rejects.toBe(failure);
  });

  it("closes the BullMQ queue during module shutdown", async () => {
    add.mockResolvedValue({ id: data.documentId });
    close.mockResolvedValue(undefined);
    const service = new IngestionQueueService();
    await service.enqueueDocument(data);

    await service.onModuleDestroy();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
