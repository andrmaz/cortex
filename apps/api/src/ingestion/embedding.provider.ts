import { createHash } from "node:crypto";

/** OpenAI text-embedding-3-small default width; used for pgvector column size. */
const EMBEDDING_DIMENSIONS = 1_536;

const REQUEST_TIMEOUT_MS = 30_000;

/** Extracts only a short machine-readable code; never the raw body, which may echo document content. */
async function readProviderErrorCode(
  response: Response,
): Promise<string | undefined> {
  try {
    const payload = (await response.json()) as {
      error?: { code?: unknown; type?: unknown };
    };
    const code = payload.error?.code ?? payload.error?.type;
    return typeof code === "string" && /^[\w.-]{1,64}$/.test(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

export const EMBEDDING_PROVIDER = Symbol("EMBEDDING_PROVIDER");

export interface EmbeddingProvider {
  embedMany(texts: readonly string[]): Promise<number[][]>;
}

/** Actionable failure from the configured embedding provider. */
export class EmbeddingProviderError extends Error {
  override readonly name = "EmbeddingProviderError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/**
 * Deterministic local embeddings for tests and local MVP without an API key.
 * Not suitable for production retrieval quality.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  embedMany(texts: readonly string[]): Promise<number[][]> {
    return Promise.resolve(texts.map((text) => hashEmbedding(text)));
  }
}

/**
 * OpenAI embeddings via the HTTP API. Requires `OPENAI_API_KEY`.
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "text-embedding-3-small",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embedMany(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    let response: Response;
    try {
      response = await this.fetchImpl("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new EmbeddingProviderError(
        `Embedding request failed: ${error instanceof Error ? error.name : "unknown error"}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      const code = await readProviderErrorCode(response);
      throw new EmbeddingProviderError(
        `Embedding provider error ${response.status}${code ? ` (${code})` : ""}`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const rows = payload.data;
    if (!Array.isArray(rows) || rows.length !== texts.length) {
      throw new EmbeddingProviderError(
        "Embedding provider returned an unexpected payload shape",
      );
    }

    return [...rows]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((row) => {
        const embedding = row.embedding;
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new EmbeddingProviderError(
            `Embedding provider returned a vector of length ${embedding?.length ?? 0}, expected ${EMBEDDING_DIMENSIONS}`,
          );
        }
        return embedding;
      });
  }
}

export function createEmbeddingProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingProvider {
  const provider = (env["EMBEDDING_PROVIDER"] ?? "deterministic").toLowerCase();
  switch (provider) {
    case "deterministic":
      return new DeterministicEmbeddingProvider();
    case "openai": {
      const apiKey = env["OPENAI_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY to be set",
        );
      }
      return new OpenAIEmbeddingProvider(
        apiKey,
        env["OPENAI_EMBEDDING_MODEL"] ?? "text-embedding-3-small",
      );
    }
    default:
      throw new Error(`Unknown EMBEDDING_PROVIDER: ${provider}`);
  }
}

function hashEmbedding(text: string): number[] {
  const digest = createHash("sha256").update(text).digest();
  const values = new Array<number>(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const byte = digest[i % digest.length] ?? 0;
    values[i] = (byte / 255) * 2 - 1;
  }
  return values;
}
