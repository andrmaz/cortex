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
  const parsed = parsePolicyDraft(typeof draft === "string" ? draft : "");
  return parsed.document
    ? { value: parsed.document }
    : { error: parsed.error ?? "Invalid policy rules." };
}

function departmentId(form: FormData): Result<string> {
  const departmentId = form.get("departmentId");
  return typeof departmentId === "string" && departmentId
    ? { value: departmentId }
    : { error: "Select a Department." };
}

function combineResults<T, U, V>(
  first: Result<T>,
  second: Result<U>,
  combine: (first: T, second: U) => V,
): Result<V> {
  if ("error" in first) return first;
  if ("error" in second) return second;
  return { value: combine(first.value, second.value) };
}

function createBody(form: FormData): Result<unknown> {
  return combineResults(
    policyDocument(form),
    departmentId(form),
    (rulesJson, departmentId) => ({ departmentId, rulesJson }),
  );
}

function updateBody(form: FormData): Result<unknown> {
  const parsed = policyDocument(form);
  return "error" in parsed ? parsed : { value: { rulesJson: parsed.value } };
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
): Result<undefined> {
  return operation !== "delete" || form.get("confirmDelete") === "yes"
    ? { value: undefined }
    : { error: "Confirm deletion before continuing." };
}

function resultError(result: Result<unknown>): string | undefined {
  return "error" in result ? result.error : undefined;
}

function prepareMutation(
  operation: PolicyOperation,
  form: FormData,
): Result<PreparedMutation> {
  const idResult = policyId(operation, form);
  const body = policyBody(operation, form);
  const confirmation = deleteConfirmation(operation, form);
  const error =
    resultError(idResult) ?? resultError(body) ?? resultError(confirmation);
  if (error) return { error };
  const selectedPolicyId = "value" in idResult ? idResult.value : undefined;
  const requestBody = "value" in body ? body.value : undefined;
  const path =
    operation === "create"
      ? ""
      : `/${encodeURIComponent(selectedPolicyId ?? "")}${routeSuffixes[operation]}`;
  return { value: { path, method: methods[operation], body: requestBody } };
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
