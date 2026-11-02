import { adminAuthHeaders } from "../_lib/admin-auth";
import type { PolicyRulesJson, PolicyVersion } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(body: { message?: string | string[] } | null): string {
  if (Array.isArray(body?.message)) {
    return body.message.join(", ");
  }
  return body?.message ?? "Policy request failed";
}

export async function fetchPolicies(
  departmentId: string,
): Promise<PolicyVersion[]> {
  const res = await fetch(
    `${API_URL}/api/admin/policies?departmentId=${encodeURIComponent(departmentId)}`,
    {
      headers: await adminAuthHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch policies: ${res.status}`);
  }

  return res.json() as Promise<PolicyVersion[]>;
}

export async function createPolicyVersion(
  departmentId: string,
  rulesJson: PolicyRulesJson,
): Promise<{ policy?: PolicyVersion; error?: string }> {
  const res = await fetch(`${API_URL}/api/admin/policies`, {
    method: "POST",
    headers: {
      ...(await adminAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ departmentId, rulesJson }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    return {
      error: getErrorMessage(
        await parseJsonSafe<{ message?: string | string[] }>(res),
      ),
    };
  }

  return { policy: (await res.json()) as PolicyVersion };
}

export async function setPolicyVersionActive(
  policyId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const action = active ? "activate" : "deactivate";
  const res = await fetch(
    `${API_URL}/api/admin/policies/${encodeURIComponent(policyId)}/${action}`,
    {
      method: "POST",
      headers: await adminAuthHeaders(),
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    return {
      error: getErrorMessage(
        await parseJsonSafe<{ message?: string | string[] }>(res),
      ),
    };
  }

  return {};
}
