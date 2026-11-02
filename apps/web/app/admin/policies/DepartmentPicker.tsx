"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { Department } from "../departments/types";

interface DepartmentPickerProps {
  organizationId: string;
  departments: Department[];
  selectedDepartmentId?: string;
}

export function DepartmentPicker({
  organizationId,
  departments,
  selectedDepartmentId,
}: DepartmentPickerProps) {
  const router = useRouter();

  return (
    <div style={fieldStyle}>
      <label htmlFor="policy-department-picker" style={labelStyle}>
        Department
      </label>
      <select
        id="policy-department-picker"
        value={selectedDepartmentId ?? ""}
        onChange={(event) => {
          const departmentId = event.target.value;
          const query = new URLSearchParams({ orgId: organizationId });
          if (departmentId) {
            query.set("departmentId", departmentId);
          }
          router.push(`/admin/policies?${query.toString()}`);
        }}
        style={selectStyle}
      >
        <option value="">Select a department…</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  maxWidth: "320px",
  marginBottom: "24px",
};

const labelStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
};

const selectStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "14px",
  background: "#fff",
};
