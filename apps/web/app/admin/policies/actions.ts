"use server";

import { revalidatePath } from "next/cache";
import { createPolicyVersion, setPolicyVersionActive } from "./api";
import { parsePolicyRulesJson } from "./policy-json";
import type { PolicyRulesJson } from "./types";

function getStringField(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function createPolicyAction(
  departmentId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const input = validatePolicyInput(departmentId, formData);
  if ("error" in input) {
    return input;
  }

  const result = await persistPolicy(input.departmentId, input.rulesJson);
  if (result.error) {
    return result;
  }

  revalidatePath("/admin/policies");
  return {};
}

function validatePolicyInput(
  departmentId: string,
  formData: FormData,
): { error: string } | { departmentId: string; rulesJson: PolicyRulesJson } {
  if (!departmentId) {
    return { error: "Select a department first." };
  }

  const parsed = parsePolicyRulesJson(getStringField(formData, "rulesJson"));
  if (!parsed.value) {
    return { error: parsed.error ?? "Policy JSON is invalid." };
  }

  return { departmentId, rulesJson: parsed.value };
}

async function persistPolicy(
  departmentId: string,
  rulesJson: PolicyRulesJson,
): Promise<{ error?: string }> {
  try {
    const result = await createPolicyVersion(departmentId, rulesJson);
    return result.error ? { error: result.error } : {};
  } catch {
    return { error: "Failed to create policy version. Please try again." };
  }
}

export async function setPolicyActiveAction(
  policyId: string,
  active: boolean,
  formData: FormData,
): Promise<{ error?: string }> {
  void formData;
  try {
    const result = await setPolicyVersionActive(policyId, active);
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to update policy activation. Please try again." };
  }

  revalidatePath("/admin/policies");
  return {};
}
