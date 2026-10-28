import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { getOrgContext } from "db";
import { MCPModule } from "./mcp.module";
import { AuthModule } from "../auth/auth.module";
import { GoogleStrategy } from "../auth/strategies/google.strategy";
import { OrgContextInterceptor } from "../common/org-context.interceptor";
import { PrismaService } from "../prisma/prisma.service";
import { SourceService } from "../admin/sources/source.service";
import { DocumentIngestionService } from "../ingestion/document-ingestion.service";
import { IngestionQueueService } from "../ingestion/ingestion-queue.service";
import {
  DeterministicEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from "../ingestion/embedding.provider";

const SECRET = "test-secret-for-mcp-e2e";

interface DocRow {
  id: string;
  sourceId: string;
  organizationId: string;
  content: string;
  metadata: { fileName: string };
  ingestionStatus: string;
  ingestionError: string | null;
}
interface ChunkRow {
  id: string;
  documentId: string;
  organizationId: string;
  content: string;
  embedding?: number[];
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    na += (a[i] ?? 0) ** 2;
    nb += (b[i] ?? 0) ** 2;
  }
  return dot / Math.sqrt(na * nb);
}

function makeFakePrisma() {
  const docs: DocRow[] = [];
  const chunks: ChunkRow[] = [];
  let seq = 0;
  const prisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    userDepartment: { findFirst: vi.fn().mockResolvedValue(null) },
    source: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => ({
        id: where.id,
        organizationId: where.id === "src-a" ? "org_a" : "org_b",
        name: "Handbook",
        type: "upload",
      })),
    },
    document: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => {
        const row = { id: `doc-${++seq}`, ...data } as DocRow;
        docs.push(row);
        return row;
      }),
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          docs.find((d) => d.id === where.id),
        ),
      update: vi.fn().mockImplementation(async ({ where, data }) => {
        const doc = docs.find((d) => d.id === where.id)!;
        Object.assign(doc, data);
        return doc;
      }),
    },
    chunk: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockImplementation(async ({ data }) => {
        for (const row of data) {
          chunks.push({ ...row, id: `chunk-${++seq}` });
        }
        return { count: data.length };
      }),
      findMany: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          chunks.filter((c) => c.documentId === where?.documentId),
        ),
    },
    writeChunkEmbeddings: vi.fn().mockImplementation(async (rows) => {
      for (const r of rows) {
        const chunk = chunks.find((c) => c.id === r.chunkId);
        if (chunk && chunk.organizationId === r.organizationId) {
          chunk.embedding = r.embedding;
        }
      }
    }),
    searchChunksBySimilarity: vi
      .fn()
      .mockImplementation(
        async (p: {
          organizationId: string;
          embedding: number[];
          limit: number;
        }) => {
          expect(getOrgContext()).toEqual({ organizationId: p.organizationId });
          return chunks
            .filter((c) => c.organizationId === p.organizationId && c.embedding)
            .map((c) => {
              const doc = docs.find((d) => d.id === c.documentId)!;
              return {
                chunkId: c.id,
                content: c.content,
                documentId: c.documentId,
                sourceId: doc.sourceId,
                documentMetadata: doc.metadata,
                score: cosine(c.embedding!, p.embedding),
              };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, p.limit);
        },
      ),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return prisma;
}

class MockGoogleStrategy {
  name = "google";
}

const token = (organizationId: string) =>
  jwt.sign(
    { sub: "u", email: "u@x.com", organizationId, role: "member" },
    SECRET,
    {
      expiresIn: "1h",
    },
  );

describe("MCP end-to-end: upload → index → query → cited response", () => {
  let app: INestApplication;
  let sources: SourceService;
  let ingestion: DocumentIngestionService;
  let previousSecret: string | undefined;

  beforeAll(async () => {
    previousSecret = process.env["JWT_SECRET"];
    process.env["JWT_SECRET"] = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [MCPModule, AuthModule],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
        SourceService,
        DocumentIngestionService,
        {
          provide: EMBEDDING_PROVIDER,
          useClass: DeterministicEmbeddingProvider,
        },
        {
          provide: IngestionQueueService,
          useValue: { enqueueDocument: vi.fn().mockResolvedValue("job") },
        },
      ],
    })
      .overrideProvider(GoogleStrategy)
      .useClass(MockGoogleStrategy)
      .overrideProvider(EMBEDDING_PROVIDER)
      .useClass(DeterministicEmbeddingProvider)
      .overrideProvider(PrismaService)
      .useValue(makeFakePrisma())
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    sources = moduleRef.get(SourceService);
    ingestion = moduleRef.get(DocumentIngestionService);
  });

  afterAll(async () => {
    await app.close();
    if (previousSecret === undefined) delete process.env["JWT_SECRET"];
    else process.env["JWT_SECRET"] = previousSecret;
  });

  async function upload(org: string, source: string, text: string) {
    const { document } = await sources.uploadDocument(org, source, {
      originalname: "handbook.txt",
      mimetype: "text/plain",
      size: text.length,
      buffer: Buffer.from(text),
    });
    await ingestion.process({
      organizationId: org,
      sourceId: source,
      documentId: document.id,
      fileName: "handbook.txt",
      mimeType: "text/plain",
    });
    return document.id;
  }

  it("returns a cited response grounded only in the caller's org", async () => {
    const docA = await upload("org_a", "src-a", "Org A uses modular monolith.");
    await upload("org_b", "src-b", "Org B secret roadmap.");

    const res = await request(app.getHttpServer())
      .post("/mcp")
      .set("Authorization", `Bearer ${token("org_a")}`)
      .send({ query: "Org A uses modular monolith." })
      .expect(201);

    expect(res.body.context).toEqual(["Org A uses modular monolith."]);
    expect(res.body.citations).toEqual([
      expect.objectContaining({
        documentId: docA,
        sourceId: "src-a",
        fileName: "handbook.txt",
      }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain("secret roadmap");
  });

  it("rejects an empty query", async () => {
    await request(app.getHttpServer())
      .post("/mcp")
      .set("Authorization", `Bearer ${token("org_a")}`)
      .send({ query: "  " })
      .expect(400);
  });
});
