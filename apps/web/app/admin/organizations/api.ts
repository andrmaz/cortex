import type { Organization } from "./types";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:3001";

/**
 * Reads the admin token from an environment variable (server-side only).
 * When user auth is wired into the web app, replace this with a call to
 * `cookies()` to read the session JWT and verify the role before forwarding.
 */
function getAdminToken(): string {
  return process.env["CORTEX_ADMIN_TOKEN"] ?? "";
}

function authHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
    headers: authHeaders(),
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
      headers: authHeaders(),
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
    headers: { ...authHeaders(), "Content-Type": "application/json" },
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
      headers: { ...authHeaders(), "Content-Type": "application/json" },
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
