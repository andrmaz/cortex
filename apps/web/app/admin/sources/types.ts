export interface Source {
  id: string;
  name: string;
  type: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
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
