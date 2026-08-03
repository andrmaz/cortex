import { adminAuthHeaders } from "../_lib/admin-auth";
import type { Organization } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:3001";

/** Safe JSON parse that returns null instead of throwing on non-JSON bodies. */
async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_URL}/api/admin/organizations`, {
    headers: await adminAuthHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch organizations: ${res.status}`);
  }

  return res.json() as Promise<Organization[]>;
}

export async function fetchOrganization(id: string): Promise<Organization> {
  const res = await fetch(
    `${API_URL}/api/admin/organizations/${encodeURIComponent(id)}`,
    {
      headers: await adminAuthHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch organization: ${res.status}`);
  }

  return res.json() as Promise<Organization>;
}

export async function createOrganization(
  name: string,
): Promise<{ org?: Organization; error?: string }> {
  const res = await fetch(`${API_URL}/api/admin/organizations`, {
    method: "POST",
    headers: {
      ...(await adminAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const errBody = await parseJsonSafe<{ message?: string }>(res);
    return { error: errBody?.message ?? "Failed to create organization" };
  }

  return { org: (await res.json()) as Organization };
}

export async function updateOrganization(
  id: string,
  name: string,
): Promise<{ org?: Organization; error?: string }> {
  const res = await fetch(
    `${API_URL}/api/admin/organizations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
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
    return { error: errBody?.message ?? "Failed to update organization" };
  }

  return { org: (await res.json()) as Organization };
}
