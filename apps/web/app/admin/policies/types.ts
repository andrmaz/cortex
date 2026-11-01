import type { PolicyDocument } from "@cortex/shared/policy";

export interface Policy {
  id: string;
  organizationId: string;
  departmentId: string;
  version: number;
  rulesJson: PolicyDocument;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyActionState {
  error?: string;
  message?: string;
}
