import { cache } from "react";
import { cookies } from "next/headers";

export const ACCESS_TOKEN_COOKIE = "cortex_access_token";

/** Matches JWT `expiresIn: "8h"` in the API auth module. */
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

export async function setAccessTokenCookie(token: string): Promise<void> {
  (await cookies()).set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function clearAccessTokenCookie(): Promise<void> {
  (await cookies()).delete(ACCESS_TOKEN_COOKIE);
}

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
