"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { Organization } from "../organizations/types";

interface OrgPickerProps {
  organizations: Organization[];
  selectedOrgId?: string;
  /** Base path to navigate to on selection, e.g. "/admin/departments". */
  basePath: string;
}

/**
 * Organization selector shared by department and user-assignment admin
 * pages. Navigates via the `orgId` search param so the selection survives
 * a page reload and can be linked to directly.
 */
export function OrgPicker({
  organizations,
  selectedOrgId,
  basePath,
}: OrgPickerProps) {
  const router = useRouter();

  return (
    <div style={fieldStyle}>
      <label htmlFor="org-picker" style={labelStyle}>
        Organization
      </label>
      <select
        id="org-picker"
        value={selectedOrgId ?? ""}
        onChange={(e) => {
          const orgId = e.target.value;
          router.push(orgId ? `${basePath}?orgId=${orgId}` : basePath);
        }}
        style={selectStyle}
      >
        <option value="" disabled>
          Select an organization…
        </option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
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
