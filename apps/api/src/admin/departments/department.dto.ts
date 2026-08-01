export interface CreateDepartmentDto {
  name: string;
}

export interface DepartmentResponseDto {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
