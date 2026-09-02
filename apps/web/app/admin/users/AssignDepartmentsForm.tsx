"use client";

import { useActionState, useState, type CSSProperties } from "react";
import type { Department } from "../departments/types";
import type { UserDepartmentAssignment } from "./types";
import { assignDepartmentsAction } from "./actions";

interface AssignDepartmentsFormProps {
  userId: string;
  departments: Department[];
  currentAssignments: UserDepartmentAssignment[];
}

type FormState = { error?: string };

const initialState: FormState = {};

export function AssignDepartmentsForm({
  userId,
  departments,
  currentAssignments,
}: AssignDepartmentsFormProps) {
  const currentIds = new Set(currentAssignments.map((a) => a.departmentId));
  const currentPrimary =
    currentAssignments.find((a) => a.isPrimary)?.departmentId ?? null;

  const [checked, setChecked] = useState<Set<string>>(currentIds);
  const [primary, setPrimary] = useState<string | null>(currentPrimary);

  const boundAction = async (
    _prev: FormState,
    formData: FormData,
  ): Promise<FormState> => assignDepartmentsAction(userId, formData);

  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  function toggleDept(id: string, isChecked: boolean): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (isChecked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    if (!isChecked && primary === id) {
      setPrimary(null);
    }
  }

  return (
    <form action={formAction} style={formStyle}>
      <h3 style={{ margin: "0 0 12px" }}>Assign departments</h3>

      {state.error && (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      )}

      {departments.length === 0 ? (
        <p style={{ color: "#6b7280", fontStyle: "italic" }}>
          Create a department first before assigning users.
        </p>
      ) : (
        <div style={listStyle}>
          {departments.map((dept) => (
            <div key={dept.id} style={rowStyle}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  name="departmentIds"
                  value={dept.id}
                  checked={checked.has(dept.id)}
                  onChange={(e) => toggleDept(dept.id, e.target.checked)}
                  disabled={isPending}
                />
                {dept.name}
              </label>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  name="primaryDepartmentId"
                  value={dept.id}
                  checked={primary === dept.id}
                  disabled={!checked.has(dept.id) || isPending}
                  onChange={() => setPrimary(dept.id)}
                />
                Primary
              </label>
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || departments.length === 0}
        style={btnStyle}
      >
        {isPending ? "Saving…" : "Save assignment"}
      </button>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
  maxWidth: "480px",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "8px 12px",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
};

const radioLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  color: "#6b7280",
};

const btnStyle: CSSProperties = {
  padding: "8px 16px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  alignSelf: "flex-start",
};

const errorStyle: CSSProperties = {
  color: "#dc2626",
  fontSize: "13px",
  margin: 0,
  padding: "8px 12px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "6px",
};
