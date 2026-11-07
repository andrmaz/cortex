import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  OrgScopeViolationError,
  runWithOrgContext,
  runWithoutOrgScope,
} from "db";
import { PrismaService } from "../prisma/prisma.service";
import { RetrievalService } from "./retrieval.service";

function vector(first: number, second = 0): number[] {
  return [first, second, ...Array<number>(1_534).fill(0)];
}

describe("retrieval against PostgreSQL and pgvector", () => {
  const organizationIds = [randomUUID(), randomUUID()];
  const fixtures = organizationIds.map((organizationId) => ({
    organizationId,
    sourceId: randomUUID(),
    documentId: randomUUID(),
    exactId: randomUUID(),
    nearId: randomUUID(),
    oppositeId: randomUUID(),
    unindexedId: randomUUID(),
  }));
  const embedMany = vi.fn().mockResolvedValue([vector(1)]);
  let prisma: PrismaService;
  let retrieval: RetrievalService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    retrieval = new RetrievalService(prisma, { embedMany });

    for (const fixture of fixtures) {
      await runWithoutOrgScope(() =>
        prisma.organization.create({
          data: {
            id: fixture.organizationId,
            name: `retrieval-test-${fixture.organizationId}`,
          },
        }),
      );
      await runWithOrgContext(fixture.organizationId, async () => {
        await prisma.source.create({
          data: {
            id: fixture.sourceId,
            organizationId: fixture.organizationId,
            name: "Handbook",
            type: "upload",
          },
        });
        await prisma.document.create({
          data: {
            id: fixture.documentId,
            organizationId: fixture.organizationId,
            sourceId: fixture.sourceId,
            content: "Shared handbook content",
            metadata: { fileName: "handbook.txt" },
          },
        });
        await prisma.chunk.createMany({
          data: [
            fixture.exactId,
            fixture.nearId,
            fixture.oppositeId,
            fixture.unindexedId,
          ].map((id) => ({
            id,
            organizationId: fixture.organizationId,
            documentId: fixture.documentId,
            content: "Identical content in both Organizations",
          })),
        });
        await prisma.writeChunkEmbeddings([
          {
            chunkId: fixture.exactId,
            organizationId: fixture.organizationId,
            embedding: vector(1),
          },
          {
            chunkId: fixture.nearId,
            organizationId: fixture.organizationId,
            embedding: vector(0.8, 0.6),
          },
          {
            chunkId: fixture.oppositeId,
            organizationId: fixture.organizationId,
            embedding: vector(-1),
          },
        ]);
      });
    }
  }, 30_000);

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    try {
      // Only delete this run's fixtures; child rows cascade via their FKs.
      await runWithoutOrgScope(() =>
        prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        }),
      );
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  it("isolates identical content by Organization and skips unindexed chunks", async () => {
    for (const fixture of fixtures) {
      const results = await runWithOrgContext(fixture.organizationId, () =>
        retrieval.search("handbook query", fixture.organizationId, 10),
      );

      expect(results.map((row) => row.chunkId)).toEqual([
        fixture.exactId,
        fixture.nearId,
        fixture.oppositeId,
      ]);
      expect(results[0]).toEqual({
        chunkId: fixture.exactId,
        content: "Identical content in both Organizations",
        score: expect.closeTo(1, 5),
        sourceRef: {
          documentId: fixture.documentId,
          sourceId: fixture.sourceId,
          fileName: "handbook.txt",
        },
      });
    }
    expect(embedMany).toHaveBeenCalledWith(["handbook query"]);
  });

  it("ranks by cosine similarity and applies top-k in the real SQL", async () => {
    for (const fixture of fixtures) {
      const results = await retrieval.search(
        "handbook query",
        fixture.organizationId,
        2,
      );
      expect(results.map((row) => row.chunkId)).toEqual([
        fixture.exactId,
        fixture.nearId,
      ]);
      expect(results.map((row) => row.score)).toEqual([
        expect.closeTo(1, 5),
        expect.closeTo(0.8, 5),
      ]);

      const [top] = await retrieval.search(
        "handbook query",
        fixture.organizationId,
        1,
      );
      expect(top?.chunkId).toBe(fixture.exactId);
    }
  });

  it("filters allowed Sources in SQL before applying top-k", async () => {
    const fixture = fixtures[0];
    expect(fixture).toBeDefined();
    if (!fixture) {
      throw new Error("Expected an Organization fixture");
    }

    const disallowedSourceId = randomUUID();
    const disallowedDocumentId = randomUUID();
    const disallowedChunkId = randomUUID();
    await runWithOrgContext(fixture.organizationId, async () => {
      await prisma.source.create({
        data: {
          id: disallowedSourceId,
          organizationId: fixture.organizationId,
          name: "Restricted handbook",
          type: "upload",
        },
      });
      await prisma.document.create({
        data: {
          id: disallowedDocumentId,
          organizationId: fixture.organizationId,
          sourceId: disallowedSourceId,
          content: "Restricted content",
          metadata: { fileName: "restricted.txt" },
        },
      });
      await prisma.chunk.create({
        data: {
          id: disallowedChunkId,
          organizationId: fixture.organizationId,
          documentId: disallowedDocumentId,
          content: "Highest scoring restricted content",
        },
      });
      await prisma.writeChunkEmbeddings([
        {
          chunkId: disallowedChunkId,
          organizationId: fixture.organizationId,
          embedding: vector(0, 1),
        },
      ]);
    });
    embedMany
      .mockResolvedValueOnce([vector(0, 1)])
      .mockResolvedValueOnce([vector(0, 1)]);

    const unfiltered = await retrieval.search(
      "source filter top-k query",
      fixture.organizationId,
      1,
    );
    const filtered = await retrieval.search(
      "source filter top-k query",
      fixture.organizationId,
      1,
      [fixture.sourceId],
    );

    expect(unfiltered[0]?.chunkId).toBe(disallowedChunkId);
    expect(filtered.map((row) => row.chunkId)).toEqual([fixture.nearId]);
    expect(filtered[0]?.sourceRef.sourceId).toBe(fixture.sourceId);
  });

  it("rejects a conflicting authenticated Organization before embedding", async () => {
    const [first, second] = fixtures;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) {
      throw new Error("Expected two Organization fixtures");
    }
    embedMany.mockClear();
    await expect(
      runWithOrgContext(first.organizationId, () =>
        retrieval.search("handbook query", second.organizationId),
      ),
    ).rejects.toThrow(OrgScopeViolationError);
    expect(embedMany).not.toHaveBeenCalled();
  });
});
