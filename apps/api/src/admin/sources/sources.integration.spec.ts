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
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  user: { findUnique: jest.fn() },
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  source: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  document: {
    create: jest.fn(),
    delete: jest.fn(),
  },
};
const queue = {
  enqueueDocument: jest.fn(),
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
    jest.clearAllMocks();
  });

  it("requires an authenticated admin", async () => {
    await request(app.getHttpServer()).post("/api/admin/sources").expect(401);

    await request(app.getHttpServer())
      .post("/api/admin/sources")
      .set("Authorization", `Bearer ${token("member")}`)
      .send({ name: "Handbook", type: "upload" })
      .expect(403);
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
  });

  it("rejects uploads without a file", async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/sources/${source.id}/documents`)
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);
  });
});
