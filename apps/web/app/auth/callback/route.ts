import { redirect } from "next/navigation";
import { setAccessTokenCookie } from "../../admin/_lib/admin-auth";

const API_URL = process.env["CORTEX_API_URL"] ?? "http://localhost:4000";

export async function GET(request: Request): Promise<never> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    redirect("/admin/organizations?auth_error=authentication_failed");
  }

  if (!code) {
    redirect("/auth/login");
  }

  let accessToken: string | undefined;
  try {
    const res = await fetch(`${API_URL}/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = (await res.json()) as { accessToken?: string };
      if (typeof body.accessToken === "string" && body.accessToken.length > 0) {
        accessToken = body.accessToken;
      }
    }
  } catch {
    // Network/timeout failures fall through to the generic auth error.
  }

  if (!accessToken) {
    redirect("/admin/organizations?auth_error=authentication_failed");
  }

  await setAccessTokenCookie(accessToken);
  redirect("/admin/organizations");
}
