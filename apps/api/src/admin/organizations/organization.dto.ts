export interface CreateOrganizationDto {
  name: string;
}

export interface UpdateOrganizationDto {
  name?: string;
}

export interface OrganizationResponseDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
