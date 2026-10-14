/** Soft upper bound for a single Chunk's text content (characters). */
const DEFAULT_CHUNK_SIZE = 1_000;

/**
 * Normalize raw Document content and split it into retrievable Chunk texts.
 *
 * Splits on blank lines first, then hard-wraps oversize paragraphs so each
 * Chunk stays within `maxChunkSize` without dropping content.
 */
export function chunkDocumentContent(
  raw: string,
  maxChunkSize: number = DEFAULT_CHUNK_SIZE,
): string[] {
  const normalized = normalizeContent(raw);
  if (normalized.length === 0) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim());
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      continue;
    }
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph);
      continue;
    }
    chunks.push(...splitOversized(paragraph, maxChunkSize));
  }

  return chunks;
}

function normalizeContent(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitOversized(text: string, maxChunkSize: number): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxChunkSize) {
    const window = remaining.slice(0, maxChunkSize);
    const breakAt = Math.max(
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf(" "),
    );
    const cut = breakAt > maxChunkSize / 4 ? breakAt + 1 : maxChunkSize;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}
