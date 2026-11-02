import { Injectable } from "@nestjs/common";
import type { RetrievedChunk } from "../retrieval/retrieval.service";

export interface Citation {
  readonly chunkId: string;
  readonly documentId: string;
  readonly sourceId: string;
  readonly fileName?: string;
  readonly score: number;
}

export interface ContextBundle {
  readonly chunks: readonly RetrievedChunk[];
  readonly citations: readonly Citation[];
}

@Injectable()
export class ContextBundleService {
  /** Assembles ranked chunks into a Context Bundle with one citation per chunk. */
  assemble(chunks: readonly RetrievedChunk[]): ContextBundle {
    return {
      chunks,
      citations: chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.sourceRef.documentId,
        sourceId: chunk.sourceRef.sourceId,
        ...(chunk.sourceRef.fileName
          ? { fileName: chunk.sourceRef.fileName }
          : {}),
        score: chunk.score,
      })),
    };
  }

  /** Deterministic cited answer grounded only in the bundle. */
  composeAnswer(query: string, bundle: ContextBundle): string {
    if (bundle.chunks.length === 0) {
      return `No relevant context found for: ${query}`;
    }
    const lines = bundle.chunks.map((chunk, i) => {
      const label = bundle.citations[i]?.fileName ?? chunk.sourceRef.documentId;
      return `[${i + 1}] ${chunk.content.trim()} (${label})`;
    });
    return `Based on organization context:\n${lines.join("\n")}`;
  }
}
