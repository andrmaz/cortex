"use server";

import { revalidatePath } from "next/cache";
import { policyRequest } from "./api";
import { mutatePolicy } from "./policy-mutation";
import type { PolicyActionState } from "./types";

export async function savePolicyAction(
  _state: PolicyActionState,
  form: FormData,
): Promise<PolicyActionState> {
  const result = await mutatePolicy(
    form.get("policyId") ? "update" : "create",
    form,
    policyRequest,
  );
  if (result.message) revalidatePath("/admin/policies");
  return result;
}

export async function lifecyclePolicyAction(
  _state: PolicyActionState,
  form: FormData,
): Promise<PolicyActionState> {
  const operation = form.get("operation");
  if (
    operation !== "activate" &&
    operation !== "deactivate" &&
    operation !== "delete"
  )
    return { error: "Unknown policy operation." };
  const result = await mutatePolicy(operation, form, policyRequest);
  if (result.message) revalidatePath("/admin/policies");
  return result;
}
