export interface PolicyRulesJson {
  rules: string[];
}

export interface CreatePolicyDto {
  departmentId: string;
  rulesJson: PolicyRulesJson;
}

export interface PolicyResponseDto {
  id: string;
  version: number;
  rulesJson: unknown;
  isActive: boolean;
  organizationId: string;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}
