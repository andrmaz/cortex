import { cache } from "react";
import { cookies } from "next/headers";

export const ACCESS_TOKEN_COOKIE = "cortex_access_token";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:3001";

export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

/**
 * Verifies the caller has an admin session JWT before privileged API calls.
 * Reads the token from the session cookie and validates role via GET /api/me.
 */
export const requireAdminAccess = cache(async (): Promise<string> => {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    throw new AdminAccessError("Sign in required to access admin pages.");
  }

  try {
    const res = await fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new AdminAccessError("Invalid or expired session.");
    }

    const user = (await res.json()) as { role: string };
    if (user.role !== "admin") {
      throw new AdminAccessError("Admin role required.");
    }

    return token;
  } catch (error) {
    if (error instanceof AdminAccessError) {
      throw error;
    }
    throw new AdminAccessError(
      "Failed to verify session. Please try again or sign in.",
    );
  }
});

export async function adminAuthHeaders(): Promise<HeadersInit> {
  const token = await requireAdminAccess();
  return { Authorization: `Bearer ${token}` };
}
