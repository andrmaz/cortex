import type { AdminUser, UserDepartmentsResponse } from "./types";

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

export async function fetchUsers(organizationId: string): Promise<AdminUser[]> {
  const res = await fetch(
    `${API_URL}/api/admin/organizations/${encodeURIComponent(organizationId)}/users`,
    {
      headers: authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch users: ${res.status}`);
  }

  return res.json() as Promise<AdminUser[]>;
}

export async function fetchUserDepartments(
  userId: string,
): Promise<UserDepartmentsResponse> {
  const res = await fetch(
    `${API_URL}/api/admin/users/${encodeURIComponent(userId)}/departments`,
    {
      headers: authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch user departments: ${res.status}`);
  }

  return res.json() as Promise<UserDepartmentsResponse>;
}

export async function assignUserDepartments(
  userId: string,
  departmentIds: string[],
  primaryDepartmentId?: string,
): Promise<{ result?: UserDepartmentsResponse; error?: string }> {
  const res = await fetch(
    `${API_URL}/api/admin/users/${encodeURIComponent(userId)}/departments`,
    {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ departmentIds, primaryDepartmentId }),
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!res.ok) {
    const errBody = await parseJsonSafe<{ message?: string }>(res);
    return { error: errBody?.message ?? "Failed to assign departments" };
  }

  return { result: (await res.json()) as UserDepartmentsResponse };
}
