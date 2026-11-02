"use server";

import { revalidatePath } from "next/cache";
import { createPolicyVersion, setPolicyVersionActive } from "./api";
import { parsePolicyRulesJson } from "./policy-json";

function getStringField(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function createPolicyAction(
  departmentId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!departmentId) {
    return { error: "Select a department first." };
  }

  const parsed = parsePolicyRulesJson(getStringField(formData, "rulesJson"));
  if (!parsed.value) {
    return { error: parsed.error ?? "Policy JSON is invalid." };
  }

  try {
    const result = await createPolicyVersion(departmentId, parsed.value);
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to create policy version. Please try again." };
  }

  revalidatePath("/admin/policies");
  return {};
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
