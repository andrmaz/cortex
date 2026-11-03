export interface PolicyResponseDto {
  id: string;
  organizationId: string;
  departmentId: string;
  version: number;
  rulesJson: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
