import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { AuthModule } from "../../auth/auth.module";
import { GoogleStrategy } from "../../auth/strategies/google.strategy";
import { IngestionQueueService } from "../../ingestion/ingestion-queue.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminModule } from "../admin.module";

const JWT_SECRET = "source-integration-secret";
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
  metadata: {},
  createdAt: now,
  updatedAt: now,
};

class MockGoogleStrategy {
  name = "google";
}

const prisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  user: { findUnique: vi.fn() },
  organization: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  department: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  source: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  document: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
const queue = {
  enqueueDocument: vi.fn(),
  getDocumentJobStatuses: vi.fn(),
};

function token(role = "admin", organizationId = "org-1"): string {
  return jwt.sign(
    {
      sub: "user-1",
      email: "admin@example.com",
      role,
      organizationId,
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

describe("Admin Sources Integration", () => {
  let app: INestApplication;
  let previousSecret: string | undefined;

  beforeAll(async () => {
    previousSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule, AuthModule],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(IngestionQueueService)
      .useValue(queue)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = previousSecret;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated admin", async () => {
    await request(app.getHttpServer()).post("/api/admin/sources").expect(401);

    await request(app.getHttpServer())
      .post("/api/admin/sources")
      .set("Authorization", `Bearer ${token("member")}`)
      .send({ name: "Handbook", type: "upload" })
      .expect(403);
  });

  it("lists organization sources with aggregated ingestion status", async () => {
    const sources = [
      {
        ...source,
        documents: [
          {
            id: "active-document",
            ingestionStatus: "pending",
            ingestionError: null,
            _count: { chunks: 1 },
          },
          {
            id: "earlier-failure",
            ingestionStatus: "failed",
            ingestionError: "Earlier failure",
            _count: { chunks: 4 },
          },
        ],
      },
      {
        ...source,
        id: "source-failed",
        name: "Failed source",
        documents: [
          {
            id: "failed-document",
            ingestionStatus: "pending",
            ingestionError: null,
            _count: { chunks: 7 },
          },
          {
            id: "still-pending-document",
            ingestionStatus: "pending",
            ingestionError: null,
            _count: { chunks: 2 },
          },
        ],
      },
      {
        ...source,
        id: "source-completed",
        name: "Completed source",
        documents: [
          {
            id: "completed-document",
            ingestionStatus: "completed",
            ingestionError: null,
            _count: { chunks: 3 },
          },
          {
            id: "another-completed-document",
            ingestionStatus: "completed",
            ingestionError: null,
            _count: { chunks: 2 },
          },
        ],
      },
      {
        ...source,
        id: "source-pending",
        name: "Pending source",
        documents: [
          {
            id: "pending-document",
            ingestionStatus: "pending",
            ingestionError: null,
            _count: { chunks: 3 },
          },
          {
            id: "stale-processing-document",
            ingestionStatus: "failed",
            ingestionError: "Temporary embedding failure",
            _count: { chunks: 5 },
          },
        ],
      },
    ];
    prisma.source.findMany.mockResolvedValue(sources);
    queue.getDocumentJobStatuses.mockResolvedValue(
      new Map([
        ["active-document", { status: "running", error: null }],
        [
          "failed-document",
          {
            status: "failed",
            error: "Embedding provider returned an invalid vector count",
          },
        ],
        ["stale-processing-document", { status: "pending", error: null }],
      ]),
    );

    const response = await request(app.getHttpServer())
      .get("/api/admin/sources")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: source.id,
        ingestionStatus: "running",
        ingestionError: null,
        completedChunkCount: 0,
      }),
      expect.objectContaining({
        id: "source-failed",
        ingestionStatus: "failed",
        ingestionError: "Embedding provider returned an invalid vector count",
        completedChunkCount: 0,
      }),
      expect.objectContaining({
        id: "source-completed",
        ingestionStatus: "completed",
        ingestionError: null,
        completedChunkCount: 5,
      }),
      expect.objectContaining({
        id: "source-pending",
        ingestionStatus: "pending",
        ingestionError: null,
        completedChunkCount: 0,
      }),
    ]);
    expect(prisma.source.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      orderBy: { createdAt: "desc" },
      include: {
        documents: {
          where: { organizationId: "org-1" },
          select: {
            id: true,
            ingestionStatus: true,
            ingestionError: true,
            _count: { select: { chunks: true } },
          },
        },
      },
    });
    expect(queue.getDocumentJobStatuses).toHaveBeenCalledTimes(1);
  });

  it("registers an organization-owned upload source", async () => {
    prisma.source.create.mockResolvedValue(source);

    const response = await request(app.getHttpServer())
      .post("/api/admin/sources")
      .set("Authorization", `Bearer ${token()}`)
      .send({ name: "  Handbook  ", type: "upload" })
      .expect(201);

    expect(response.body).toMatchObject({
      id: source.id,
      name: source.name,
      type: "upload",
      organizationId: "org-1",
    });
    expect(prisma.source.create).toHaveBeenCalledWith({
      data: {
        name: "Handbook",
        type: "upload",
        organizationId: "org-1",
      },
    });
  });

  it("rejects unsupported source types", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/sources")
      .set("Authorization", `Bearer ${token()}`)
      .send({ name: "Wiki", type: "confluence" })
      .expect(400);
  });

  it("uploads a document and returns the BullMQ job id", async () => {
    prisma.source.findUnique.mockResolvedValue(source);
    prisma.document.create.mockResolvedValue(document);
    queue.enqueueDocument.mockResolvedValue("job-123");

    const response = await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .attach("file", Buffer.from("Hello Cortex"), {
        filename: "handbook.txt",
        contentType: "text/plain",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: document.id,
      sourceId: source.id,
      organizationId: "org-1",
      fileName: "handbook.txt",
      mimeType: "text/plain",
      size: 12,
      jobId: "job-123",
    });
    expect(prisma.source.findUnique).toHaveBeenCalledWith({
      where: { id: source.id, organizationId: "org-1" },
    });
  });

  it("rejects malformed UTF-8 uploads", async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .attach("file", Buffer.from([0xff, 0xfe, 0xfd]), {
        filename: "broken.txt",
        contentType: "text/plain",
      })
      .expect(400);

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(queue.enqueueDocument).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON when the client MIME type is application/json", async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .attach("file", Buffer.from("{not-json"), {
        filename: "broken.json",
        contentType: "application/json",
      })
      .expect(400);

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(queue.enqueueDocument).not.toHaveBeenCalled();
  });

  it("reuses an existing document when the idempotency key matches", async () => {
    const existing = {
      ...document,
      metadata: { idempotencyKey: "upload-1" },
    };
    prisma.source.findUnique.mockResolvedValue(source);
    prisma.document.findFirst.mockResolvedValue(existing);
    queue.enqueueDocument.mockResolvedValue(existing.id);

    const response = await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .set("Idempotency-Key", "upload-1")
      .attach("file", Buffer.from("Hello Cortex"), {
        filename: "handbook.txt",
        contentType: "text/plain",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: existing.id,
      jobId: existing.id,
    });
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key reused for different file content", async () => {
    prisma.source.findUnique.mockResolvedValue(source);
    prisma.document.findFirst.mockResolvedValue({
      ...document,
      content: "stored",
    });

    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .set("Idempotency-Key", "upload-1")
      .attach("file", Buffer.from("Hello Cortex"), {
        filename: "handbook.txt",
        contentType: "text/plain",
      })
      .expect(409);

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(queue.enqueueDocument).not.toHaveBeenCalled();
  });

  it("rejects uploads without a file", async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);
  });
});
