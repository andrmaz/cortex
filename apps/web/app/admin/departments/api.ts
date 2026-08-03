import { adminAuthHeaders } from "../_lib/admin-auth";
import type { Department } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:3001";

/** Safe JSON parse that returns null instead of throwing on non-JSON bodies. */
async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchDepartments(
  organizationId: string,
): Promise<Department[]> {
  const res = await fetch(
    `${API_URL}/api/admin/organizations/${encodeURIComponent(organizationId)}/departments`,
    {
      headers: await adminAuthHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch departments: ${res.status}`);
  }

  return res.json() as Promise<Department[]>;
}

export async function createDepartment(
  organizationId: string,
  name: string,
): Promise<{ department?: Department; error?: string }> {
  const res = await fetch(
    `${API_URL}/api/admin/organizations/${encodeURIComponent(organizationId)}/departments`,
    {
      method: "POST",
      headers: {
        ...(await adminAuthHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    const errBody = await parseJsonSafe<{ message?: string }>(res);
    return { error: errBody?.message ?? "Failed to create department" };
  }

  return { department: (await res.json()) as Department };
}
