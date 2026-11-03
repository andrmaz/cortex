"use server";

import { revalidatePath } from "next/cache";
import { policyRequest } from "./api";
import { mutatePolicy, type PolicyOperation } from "./policy-mutation";
import type { PolicyActionState } from "./types";

function isLifecycleOperation(
  operation: FormDataEntryValue | null,
): operation is Extract<PolicyOperation, "activate" | "deactivate" | "delete"> {
  return (
    operation === "activate" ||
    operation === "deactivate" ||
    operation === "delete"
  );
}

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
  if (!isLifecycleOperation(operation))
    return { error: "Unknown policy operation." };
  const result = await mutatePolicy(operation, form, policyRequest);
  if (result.message) revalidatePath("/admin/policies");
  return result;
}
