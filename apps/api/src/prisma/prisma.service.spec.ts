import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  vi,
  type Mock,
} from "vitest";
import {
  MissingOrgContextError,
  OrgScopeViolationError,
  runWithOrgContext,
  runWithoutOrgScope,
} from "db";
import { PrismaService } from "./prisma.service";

function makeRows(count: number, organizationId = "org-a") {
  return Array.from({ length: count }, (_, i) => ({
    chunkId: `chunk-${i}`,
    organizationId,
    embedding: [0.1, 0.2, i],
  }));
}

describe("PrismaService.searchChunksBySimilarity", () => {
  let service: PrismaService;

  beforeAll(() => {
    process.env["DATABASE_URL"] ??= "******localhost:5432/cortex";
    service = new PrismaService();
  });

  const params = { organizationId: "org-a", embedding: [0.1, 0.2], limit: 5 };

  it("rejects when no org context is active", async () => {
    await expect(service.searchChunksBySimilarity(params)).rejects.toThrow(
      MissingOrgContextError,
    );
  });

  it("rejects a mismatched organization", async () => {
    await expect(
      runWithOrgContext("org-b", () =>
        service.searchChunksBySimilarity(params),
      ),
    ).rejects.toThrow(OrgScopeViolationError);
  });

  it("rejects an unscoped context", async () => {
    await expect(
      runWithoutOrgScope(() => service.searchChunksBySimilarity(params)),
    ).rejects.toThrow(OrgScopeViolationError);
  });
});

describe("PrismaService.writeChunkEmbeddings", () => {
  let service: PrismaService;
  let executeRaw: Mock;
  let tx: { $executeRaw: Mock };

  beforeAll(() => {
    process.env["DATABASE_URL"] ??=
      "postgresql://user:pass@localhost:5432/cortex";
    service = new PrismaService();
  });

  beforeEach(() => {
    executeRaw = vi.fn();
    tx = { $executeRaw: executeRaw };
  });

  it("is a no-op for empty input", async () => {
    await service.writeChunkEmbeddings([], tx as never);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("rejects when no org context is active", async () => {
    await expect(
      service.writeChunkEmbeddings(makeRows(1), tx as never),
    ).rejects.toBeInstanceOf(MissingOrgContextError);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("rejects rows belonging to another organization", async () => {
    await expect(
      runWithOrgContext("org-a", () =>
        service.writeChunkEmbeddings(
          [...makeRows(1), { ...makeRows(1, "org-b")[0]!, chunkId: "x" }],
          tx as never,
        ),
      ),
    ).rejects.toBeInstanceOf(OrgScopeViolationError);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("writes matching-org rows in a single batched statement", async () => {
    executeRaw.mockResolvedValue(3);
    await runWithOrgContext("org-a", () =>
      service.writeChunkEmbeddings(makeRows(3), tx as never),
    );
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("allows cross-org rows in an explicit unscoped context", async () => {
    executeRaw.mockResolvedValue(2);
    const rows = [...makeRows(1, "org-a"), ...makeRows(1, "org-b")].map(
      (r, i) => ({ ...r, chunkId: `c${i}` }),
    );
    await runWithoutOrgScope(() =>
      service.writeChunkEmbeddings(rows, tx as never),
    );
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("splits into batches of 100", async () => {
    executeRaw.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
    await runWithOrgContext("org-a", () =>
      service.writeChunkEmbeddings(makeRows(150), tx as never),
    );
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it("throws when affected row count differs from rows supplied", async () => {
    executeRaw.mockResolvedValue(2);
    await expect(
      runWithOrgContext("org-a", () =>
        service.writeChunkEmbeddings(makeRows(3), tx as never),
      ),
    ).rejects.toThrow(/expected 3 updated rows, got 2/);
  });

  it("rejects empty embeddings and duplicate chunk ids", async () => {
    await expect(
      runWithOrgContext("org-a", () =>
        service.writeChunkEmbeddings(
          [{ chunkId: "a", organizationId: "org-a", embedding: [] }],
          tx as never,
        ),
      ),
    ).rejects.toThrow(/non-empty/);
    const dup = makeRows(1);
    await expect(
      runWithOrgContext("org-a", () =>
        service.writeChunkEmbeddings([...dup, ...dup], tx as never),
      ),
    ).rejects.toThrow(/duplicate/);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
