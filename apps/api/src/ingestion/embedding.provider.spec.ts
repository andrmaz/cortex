import { OpenAIEmbeddingProvider } from "./embedding.provider";

function okFetch() {
  return jest.fn((_url: string, init: { body: string }) => {
    const { input } = JSON.parse(init.body) as { input: string[] };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: input.map((_, index) => ({
            index,
            embedding: new Array<number>(1536).fill(index),
          })),
        }),
        { status: 200 },
      ),
    );
  });
}

function bodies(fetchMock: ReturnType<typeof okFetch>) {
  return fetchMock.mock.calls.map(
    ([, init]) =>
      JSON.parse(init.body) as {
        input: string[];
        dimensions?: number;
        model: string;
      },
  );
}

describe("OpenAIEmbeddingProvider", () => {
  it("sends dimensions for text-embedding-3 models", async () => {
    const fetchMock = okFetch();
    const provider = new OpenAIEmbeddingProvider(
      "key",
      "text-embedding-3-large",
      fetchMock as unknown as typeof fetch,
    );
    await provider.embedMany(["a"]);

    expect(bodies(fetchMock)[0]?.dimensions).toBe(1536);
  });

  it("omits dimensions for other models", async () => {
    const fetchMock = okFetch();
    const provider = new OpenAIEmbeddingProvider(
      "key",
      "text-embedding-ada-002",
      fetchMock as unknown as typeof fetch,
    );
    await provider.embedMany(["a"]);

    expect(bodies(fetchMock)[0]).not.toHaveProperty("dimensions");
  });

  it("batches by input count, preserving order", async () => {
    const fetchMock = okFetch();
    const provider = new OpenAIEmbeddingProvider(
      "key",
      "text-embedding-3-small",
      fetchMock as unknown as typeof fetch,
    );
    const texts = Array.from({ length: 600 }, (_, i) => `t${i}`);
    const vectors = await provider.embedMany(texts);

    expect(bodies(fetchMock).map((b) => b.input.length)).toEqual([256, 256, 88]);
    expect(bodies(fetchMock).flatMap((b) => b.input)).toEqual(texts);
    expect(vectors).toHaveLength(600);
  });

  it("batches by estimated token budget", async () => {
    const fetchMock = okFetch();
    const provider = new OpenAIEmbeddingProvider(
      "key",
      "text-embedding-3-small",
      fetchMock as unknown as typeof fetch,
    );
    const big = "x".repeat(300_000); // ~100k estimated tokens each
    await provider.embedMany([big, big, big]);

    expect(bodies(fetchMock).map((b) => b.input.length)).toEqual([2, 1]);
  });

  it("returns no vectors and makes no request for empty input", async () => {
    const fetchMock = okFetch();
    const provider = new OpenAIEmbeddingProvider(
      "key",
      "text-embedding-3-small",
      fetchMock as unknown as typeof fetch,
    );

    await expect(provider.embedMany([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces sanitized errors", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "rate_limit", message: "secret text" } }),
        { status: 429 },
      ),
    );
    const provider = new OpenAIEmbeddingProvider(
      "key",
      "text-embedding-3-small",
      fetchMock as unknown as typeof fetch,
    );

    await expect(provider.embedMany(["a"])).rejects.toThrow(
      "Embedding provider error 429 (rate_limit)",
    );
  });
});
