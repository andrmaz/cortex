"use server";

import { revalidatePath } from "next/cache";
import { createDepartment } from "./api";

/**
 * Safely extract a string field from FormData.
 * FormData.get() can return a File object, so we guard with typeof before
 * calling .trim() to avoid a runtime TypeError.
 */
function getStringField(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function createDepartmentAction(
  organizationId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!organizationId) {
    return { error: "Select an organization first" };
  }

  const name = getStringField(formData, "name");
  if (!name) {
    return { error: "Department name is required" };
  }

  try {
    const result = await createDepartment(organizationId, name);
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to create department. Please try again." };
  }

  revalidatePath("/admin/departments");
  return {};
}
