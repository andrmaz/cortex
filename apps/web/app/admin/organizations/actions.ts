"use server";

import { revalidatePath } from "next/cache";
import { createOrganization, updateOrganization } from "./api";

/**
 * Safely extract a string field from FormData.
 * FormData.get() can return a File object, so we guard with typeof before
 * calling .trim() to avoid a runtime TypeError.
 */
function getStringField(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function createOrganizationAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const name = getStringField(formData, "name");

  if (!name) {
    return { error: "Organization name is required" };
  }

  try {
    const result = await createOrganization(name);
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to create organization. Please try again." };
  }

  revalidatePath("/admin/organizations");
  return {};
}

export async function updateOrganizationAction(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!id || typeof id !== "string") {
    return { error: "Invalid organization id" };
  }

  const name = getStringField(formData, "name");

  if (!name) {
    return { error: "Organization name is required" };
  }

  try {
    const result = await updateOrganization(id, name);
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to update organization. Please try again." };
  }

  revalidatePath("/admin/organizations");
  return {};
}
