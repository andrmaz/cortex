import { redirect } from "next/navigation";
import { clearAccessTokenCookie } from "../../admin/_lib/admin-auth";

export async function GET(): Promise<never> {
  await clearAccessTokenCookie();
  redirect("/admin/organizations");
}
