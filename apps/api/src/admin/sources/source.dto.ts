export const SUPPORTED_SOURCE_TYPES = ["upload"] as const;

export type SourceType = (typeof SUPPORTED_SOURCE_TYPES)[number];

export interface CreateSourceDto {
  name: string;
  type: SourceType;
}

export interface SourceResponseDto {
  id: string;
  name: string;
  type: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentResponseDto {
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
