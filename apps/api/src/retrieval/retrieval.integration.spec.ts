import { describe, it, expect, vi } from "vitest";
import { getOrgContext, OrgScopeViolationError, runWithOrgContext } from "db";
import { DeterministicEmbeddingProvider } from "../ingestion/embedding.provider";
import type {
  ChunkSimilarityRow,
  PrismaService,
} from "../prisma/prisma.service";
import { MAX_TOP_K, RetrievalService } from "./retrieval.service";

interface StoredChunk {
  id: string;
  organizationId: string;
  documentId: string;
  content: string;
  embedding: number[];
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

/** In-memory stand-in honouring the same org filter, ranking and limit as the SQL. */
function makeFakePrisma(store: StoredChunk[]) {
  const search = vi.fn(
    async (params: {
      organizationId: string;
      embedding: readonly number[];
      limit: number;
    }): Promise<ChunkSimilarityRow[]> => {
      expect(getOrgContext()).toEqual({
        organizationId: params.organizationId,
      });
      return store
        .filter((c) => c.organizationId === params.organizationId)
        .map((c) => ({
          chunkId: c.id,
          content: c.content,
          documentId: c.documentId,
          sourceId: `source-of-${c.organizationId}`,
          documentMetadata: { fileName: `${c.documentId}.txt` },
          score: cosine(c.embedding, params.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit);
    },
  );
  return {
    search,
    prisma: { searchChunksBySimilarity: search } as unknown as PrismaService,
  };
}

describe("RetrievalService org isolation", () => {
  const embeddings = new DeterministicEmbeddingProvider();

  it("rejects a conflicting active org before embedding or searching", async () => {
    const { prisma, search } = makeFakePrisma([]);
    const embedMany = vi.fn().mockResolvedValue([[1]]);
    const service = new RetrievalService(prisma, { embedMany });

    await runWithOrgContext("org-a", async () => {
      await expect(service.search("q", "org-b")).rejects.toThrow(
        OrgScopeViolationError,
      );
      expect(getOrgContext()).toEqual({ organizationId: "org-a" });
    });

    expect(embedMany).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("preserves a matching active org across retrieval", async () => {
    const { prisma, search } = makeFakePrisma([]);
    const service = new RetrievalService(prisma, embeddings);

    await runWithOrgContext("org-a", async () => {
      await expect(service.search("q", "org-a")).resolves.toEqual([]);
      expect(getOrgContext()).toEqual({ organizationId: "org-a" });
    });

    expect(search).toHaveBeenCalledOnce();
  });

  async function seed(): Promise<StoredChunk[]> {
    const texts = ["Refund policy: 30 days.", "Unrelated onboarding text."];
    const vectors = await embeddings.embedMany(texts);
    const chunks: StoredChunk[] = [];
    for (const org of ["org-a", "org-b"]) {
      texts.forEach((content, i) => {
        chunks.push({
          id: `${org}-chunk-${i}`,
          organizationId: org,
          documentId: `${org}-doc`,
          content,
          embedding: vectors[i] ?? [],
        });
      });
    }
    return chunks;
  }

  it("returns only the caller's chunks when two orgs hold identical content", async () => {
    const { prisma } = makeFakePrisma(await seed());
    const service = new RetrievalService(prisma, embeddings);

    const a = await service.search("Refund policy: 30 days.", "org-a", 10);
    const b = await service.search("Refund policy: 30 days.", "org-b", 10);

    expect(a.map((r) => r.chunkId).sort()).toEqual([
      "org-a-chunk-0",
      "org-a-chunk-1",
    ]);
    expect(b.map((r) => r.chunkId).sort()).toEqual([
      "org-b-chunk-0",
      "org-b-chunk-1",
    ]);
  });

  it("ranks by score and returns the structured shape", async () => {
    const { prisma } = makeFakePrisma(await seed());
    const service = new RetrievalService(prisma, embeddings);

    const [top, second] = await service.search(
      "Refund policy: 30 days.",
      "org-a",
      2,
    );

    expect(top).toEqual({
      chunkId: "org-a-chunk-0",
      content: "Refund policy: 30 days.",
      score: expect.closeTo(1, 5),
      sourceRef: {
        sourceId: "source-of-org-a",
        documentId: "org-a-doc",
        fileName: "org-a-doc.txt",
      },
    });
    expect(top?.score).toBeGreaterThan(second?.score ?? 0);
  });

  it("clamps topK and rejects blank queries", async () => {
    const { prisma, search } = makeFakePrisma([]);
    const service = new RetrievalService(prisma, embeddings);

    await service.search("q", "org-a", 10_000);
    await service.search("q", "org-a", 0);
    expect(search.mock.calls.map(([p]) => p.limit)).toEqual([MAX_TOP_K, 1]);
    await expect(service.search("   ", "org-a")).rejects.toThrow(/empty/);
  });
});
