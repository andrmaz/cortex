export interface QueryLogCitationDto {
  chunkId: string;
  documentId: string;
  sourceId: string;
  score: number;
}

export interface QueryLogResponseDto {
  id: string;
  createdAt: string;
  actor: { userId: string; email: string };
  organizationId: string;
  department: { id: string; name: string | null } | null;
  query: string;
  /** Full recorded policy decision trace, or null when none was stored. */
  policyDecision: unknown;
  /** Chunk/document/source references only; never chunk content. */
  citations: QueryLogCitationDto[];
  latencyMs: number | null;
}

export interface QueryLogPageDto {
  items: QueryLogResponseDto[];
  nextCursor: string | null;
}
