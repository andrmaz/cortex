import { redirect } from "next/navigation";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

/** Starts Google OAuth on the API; callback redirects back to set the session cookie. */
export function GET(): never {
  redirect(`${API_URL}/auth/google`);
}
