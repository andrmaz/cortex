import { chunkDocumentContent } from "./text-chunker";

describe("chunkDocumentContent", () => {
  it("splits blank-line paragraphs into Chunk texts", () => {
    expect(
      chunkDocumentContent("Alpha paragraph.\n\nBeta paragraph."),
    ).toEqual(["Alpha paragraph.", "Beta paragraph."]);
  });

  it("hard-wraps oversized paragraphs without dropping text", () => {
    const long = "word ".repeat(300).trim();
    const chunks = chunkDocumentContent(long, 100);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.join("")).toContain("word");
    expect(chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBeGreaterThan(
      long.length / 2,
    );
  });

  it("returns an empty list for blank content", () => {
    expect(chunkDocumentContent("  \n\n  ")).toEqual([]);
  });
}));

  it("does not split surrogate pairs when hard-cutting", () => {
    const text = "a".repeat(9) + "??" + "b".repeat(20);
    const chunks = chunkDocumentContent(text, 10);

    expect(chunks.join("")).toBe(text);
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/[\ud800-\udbff]$|^[\udc00-\udfff]/);
    }
  });
});
