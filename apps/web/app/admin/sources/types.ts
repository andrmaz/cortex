export interface Source {
  id: string;
  name: string;
  type: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  ingestionStatus: "pending" | "running" | "completed" | "failed";
  ingestionError: string | null;
  completedChunkCount: number;
}

export interface UploadedDocument {
  id: string;
  sourceId: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  jobId: string;
}
