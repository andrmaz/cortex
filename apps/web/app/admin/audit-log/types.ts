export interface AuditLogCitation {
  chunkId: string;
  documentId: string;
  sourceId: string;
  score: number;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  actor: { userId: string; email: string };
  organizationId: string;
  department: { id: string; name: string | null } | null;
  query: string;
  policyDecision: unknown;
  citations: AuditLogCitation[];
  latencyMs: number | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

export interface AuditLogFilterValues {
  from?: string;
  to?: string;
  userId?: string;
  departmentId?: string;
  cursor?: string;
}
