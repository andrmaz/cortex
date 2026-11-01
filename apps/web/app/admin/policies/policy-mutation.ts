// @ts-expect-error Native Node tests require the TypeScript extension.
import { parsePolicyDraft } from "./editor-validation.ts";
import type { PolicyActionState } from "./types";

export type PolicyOperation =
  | "create"
  | "update"
  | "activate"
  | "deactivate"
  | "delete";
export type PolicyRequest = (
  path: string,
  method: string,
  body?: unknown,
) => Promise<Response>;

/** Shared action boundary, separate from Next cache/auth adapters for native tests. */
export async function mutatePolicy(
  operation: PolicyOperation,
  form: FormData,
  request: PolicyRequest,
): Promise<PolicyActionState> {
  const id = form.get("policyId");
  if (operation !== "create" && (typeof id !== "string" || !id))
    return { error: "Select a policy version." };
  let body: unknown;
  if (operation === "create" || operation === "update") {
    const draft = form.get("rulesJson");
    const parsed = parsePolicyDraft(typeof draft === "string" ? draft : "");
    if (!parsed.document) return { error: parsed.error };
    body = { rulesJson: parsed.document };
    if (operation === "create") {
      const departmentId = form.get("departmentId");
      if (typeof departmentId !== "string" || !departmentId)
        return { error: "Select a Department." };
      body = { departmentId, rulesJson: parsed.document };
    }
  }
  if (operation === "delete" && form.get("confirmDelete") !== "yes")
    return { error: "Confirm deletion before continuing." };
  const suffix =
    operation === "create" ? "" : `/${encodeURIComponent(String(id))}`;
  const path =
    operation === "activate" || operation === "deactivate"
      ? `${suffix}/${operation}`
      : suffix;
  const method =
    operation === "delete"
      ? "DELETE"
      : operation === "update"
        ? "PATCH"
        : "POST";
  try {
    const res = await request(path, method, body);
    if (!res.ok) {
      let message: unknown;
      try {
        message = ((await res.json()) as { message?: unknown }).message;
      } catch {
        /* Non-JSON failures use the safe fallback. */
      }
      return {
        error:
          typeof message === "string"
            ? message
            : Array.isArray(message)
              ? message.join("; ")
              : "Policy change failed. Try again.",
      };
    }
    return {
      message:
        operation === "create"
          ? "Inactive policy version created."
          : operation === "update"
            ? "Policy draft saved."
            : operation === "delete"
              ? "Policy version deleted."
              : operation === "activate"
                ? "Policy activated; other versions in this Department are inactive."
                : "Policy deactivated.",
    };
  } catch {
    return {
      error: "Unable to save the policy. Check your connection and try again.",
    };
  }
}
