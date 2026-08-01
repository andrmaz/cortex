"use server";

import { revalidatePath } from "next/cache";
import { assignUserDepartments } from "./api";

export async function assignDepartmentsAction(
  userId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!userId) {
    return { error: "Select a user first" };
  }

  const departmentIds = formData
    .getAll("departmentIds")
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  if (departmentIds.length === 0) {
    return { error: "Select at least one department" };
  }

  const rawPrimary = formData.get("primaryDepartmentId");
  const primaryDepartmentId =
    typeof rawPrimary === "string" && rawPrimary.length > 0
      ? rawPrimary
      : undefined;

  try {
    const result = await assignUserDepartments(
      userId,
      departmentIds,
      primaryDepartmentId,
    );
    if (result.error) {
      return { error: result.error };
    }
  } catch {
    return { error: "Failed to assign departments. Please try again." };
  }

  revalidatePath("/admin/users");
  return {};
}
