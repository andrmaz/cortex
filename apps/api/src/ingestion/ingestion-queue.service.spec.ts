import { Queue } from "bullmq";
import {
  INGEST_DOCUMENT_JOB_NAME,
  INGESTION_QUEUE_NAME,
  IngestionQueueService,
  type IngestDocumentJobData,
} from "./ingestion-queue.service";

const add = jest.fn();
const close = jest.fn();

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({ add, close })),
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
    add.mockResolvedValue({ id: "job-1" });
    const service = new IngestionQueueService();

    await expect(service.enqueueDocument(data)).resolves.toBe("job-1");
    expect(Queue).toHaveBeenCalledWith(
      INGESTION_QUEUE_NAME,
      expect.objectContaining({
        connection: { url: "redis://queue.example:6379" },
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          removeOnFail: false,
        }),
      }),
    );
    expect(add).toHaveBeenCalledWith(INGEST_DOCUMENT_JOB_NAME, data);
  });

  it("closes the BullMQ queue during module shutdown", async () => {
    add.mockResolvedValue({ id: "job-1" });
    close.mockResolvedValue(undefined);
    const service = new IngestionQueueService();
    await service.enqueueDocument(data);

    await service.onModuleDestroy();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
