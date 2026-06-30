"use server";

import { revalidatePath } from "next/cache";
import { createOrganization, updateOrganization } from "./api";

export async function createOrganizationAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";

  if (!name) {
    return { error: "Organization name is required" };
  }

  const result = await createOrganization(name);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/organizations");
  return {};
}

export async function updateOrganizationAction(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";

  if (!name) {
    return { error: "Organization name is required" };
  }

  const result = await updateOrganization(id, name);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/organizations");
  return {};
}
