export interface PolicyRulesJson {
  rules: string[];
}

export interface PolicyVersion {
  id: string;
  version: number;
  rulesJson: PolicyRulesJson;
  isActive: boolean;
  organizationId: string;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyJsonParseResult {
  value?: PolicyRulesJson;
  error?: string;
}
