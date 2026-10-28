import { describe, it, expect } from "vitest";
import { ContextBundleService } from "./context-bundle.service";

const service = new ContextBundleService();

describe("ContextBundleService", () => {
  it("builds one citation per chunk preserving rank order", () => {
    const bundle = service.assemble([
      {
        chunkId: "c1",
        content: "alpha",
        score: 0.9,
        sourceRef: { sourceId: "s1", documentId: "d1", fileName: "a.txt" },
      },
      {
        chunkId: "c2",
        content: "beta",
        score: 0.5,
        sourceRef: { sourceId: "s1", documentId: "d2" },
      },
    ]);
    expect(bundle.citations).toEqual([
      {
        chunkId: "c1",
        documentId: "d1",
        sourceId: "s1",
        fileName: "a.txt",
        score: 0.9,
      },
      { chunkId: "c2", documentId: "d2", sourceId: "s1", score: 0.5 },
    ]);
    expect(service.composeAnswer("q", bundle)).toContain("[1] alpha (a.txt)");
  });

  it("reports no context for an empty bundle", () => {
    const bundle = service.assemble([]);
    expect(bundle.citations).toEqual([]);
    expect(service.composeAnswer("q", bundle)).toContain("No relevant context");
  });
});
