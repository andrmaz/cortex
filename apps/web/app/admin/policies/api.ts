import { adminAuthHeaders } from "../_lib/admin-auth";
import type { Policy } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

export async function policyRequest(
  path = "",
  method = "GET",
  body?: unknown,
): Promise<Response> {
  return fetch(`${API_URL}/api/admin/policies${path}`, {
    method,
    headers: {
      ...(await adminAuthHeaders()),
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

export async function fetchPolicies(): Promise<Policy[]> {
  const res = await policyRequest();
  if (!res.ok)
    throw new Error(
      "Unable to load policies. Check your session and try again.",
    );
  return res.json() as Promise<Policy[]>;
}
