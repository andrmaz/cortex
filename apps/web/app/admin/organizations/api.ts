import type { Organization } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:3001";

/**
 * Reads the admin token from an environment variable (server-side only).
 * When the auth flow is wired into the web app, replace this with a call
 * to `cookies()` to read the session JWT instead.
 */
function getAdminToken(): string {
  return process.env["CORTEX_ADMIN_TOKEN"] ?? "";
}

function authHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_URL}/api/admin/organizations`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch organizations: ${res.status}`);
  }

  return res.json() as Promise<Organization[]>;
}

export async function fetchOrganization(id: string): Promise<Organization> {
  const res = await fetch(`${API_URL}/api/admin/organizations/${id}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

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
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const data = (await res.json()) as Organization & { message?: string };

  if (!res.ok) {
    return { error: data.message ?? "Failed to create organization" };
  }

  return { org: data };
}

export async function updateOrganization(
  id: string,
  name: string,
): Promise<{ org?: Organization; error?: string }> {
  const res = await fetch(`${API_URL}/api/admin/organizations/${id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const data = (await res.json()) as Organization & { message?: string };

  if (!res.ok) {
    return { error: data.message ?? "Failed to update organization" };
  }

  return { org: data };
}
