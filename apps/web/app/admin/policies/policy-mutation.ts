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

type Result<T> = { value: T } | { error: string };
type PreparedMutation = {
  path: string;
  method: string;
  body?: unknown;
};

const methods: Record<PolicyOperation, string> = {
  create: "POST",
  update: "PATCH",
  activate: "POST",
  deactivate: "POST",
  delete: "DELETE",
};

const routeSuffixes: Record<PolicyOperation, string> = {
  create: "",
  update: "",
  activate: "/activate",
  deactivate: "/deactivate",
  delete: "",
};

const successMessages: Record<PolicyOperation, string> = {
  create: "Inactive policy version created.",
  update: "Policy draft saved.",
  activate: "Policy activated; other versions in this Department are inactive.",
  deactivate: "Policy deactivated.",
  delete: "Policy version deleted.",
};

function policyId(
  operation: PolicyOperation,
  form: FormData,
): Result<string | undefined> {
  if (operation === "create") return { value: undefined };
  const id = form.get("policyId");
  return typeof id === "string" && id
    ? { value: id }
    : { error: "Select a policy version." };
}

function policyDocument(form: FormData) {
  const draft = form.get("rulesJson");
  return parsePolicyDraft(typeof draft === "string" ? draft : "");
}

function createBody(form: FormData): Result<unknown> {
  const parsed = policyDocument(form);
  if (!parsed.document)
    return { error: parsed.error ?? "Invalid policy rules." };
  const departmentId = form.get("departmentId");
  if (typeof departmentId !== "string" || !departmentId)
    return { error: "Select a Department." };
  return { value: { departmentId, rulesJson: parsed.document } };
}

function updateBody(form: FormData): Result<unknown> {
  const parsed = policyDocument(form);
  return parsed.document
    ? { value: { rulesJson: parsed.document } }
    : { error: parsed.error ?? "Invalid policy rules." };
}

function policyBody(
  operation: PolicyOperation,
  form: FormData,
): Result<unknown | undefined> {
  if (operation === "create") return createBody(form);
  if (operation === "update") return updateBody(form);
  return { value: undefined };
}

function deleteConfirmation(
  operation: PolicyOperation,
  form: FormData,
): string | undefined {
  return operation === "delete" && form.get("confirmDelete") !== "yes"
    ? "Confirm deletion before continuing."
    : undefined;
}

function prepareMutation(
  operation: PolicyOperation,
  form: FormData,
): Result<PreparedMutation> {
  const id = policyId(operation, form);
  if ("error" in id) return id;
  const body = policyBody(operation, form);
  if ("error" in body) return body;
  const confirmationError = deleteConfirmation(operation, form);
  if (confirmationError) return { error: confirmationError };
  const path =
    operation === "create"
      ? ""
      : `/${encodeURIComponent(id.value ?? "")}${routeSuffixes[operation]}`;
  return { value: { path, method: methods[operation], body: body.value } };
}

async function responseError(response: Response): Promise<string> {
  try {
    const message = ((await response.json()) as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join("; ");
  } catch {
    /* Non-JSON failures use the safe fallback. */
  }
  return "Policy change failed. Try again.";
}

/** Shared action boundary, separate from Next cache/auth adapters for native tests. */
export async function mutatePolicy(
  operation: PolicyOperation,
  form: FormData,
  request: PolicyRequest,
): Promise<PolicyActionState> {
  const prepared = prepareMutation(operation, form);
  if ("error" in prepared) return { error: prepared.error };
  try {
    const response = await request(
      prepared.value.path,
      prepared.value.method,
      prepared.value.body,
    );
    if (!response.ok) return { error: await responseError(response) };
    return { message: successMessages[operation] };
  } catch {
    return {
      error: "Unable to save the policy. Check your connection and try again.",
    };
  }
}
