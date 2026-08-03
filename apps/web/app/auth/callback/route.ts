import { redirect } from "next/navigation";
import { setAccessTokenCookie } from "../../admin/_lib/admin-auth";

export async function GET(request: Request): Promise<never> {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("accessToken");
  const error = searchParams.get("error");

  if (error) {
    redirect(
      `/admin/organizations?auth_error=${encodeURIComponent(error)}`,
    );
  }

  if (!accessToken) {
    redirect("/auth/login");
  }

  await setAccessTokenCookie(accessToken);
  redirect("/admin/organizations");
}
