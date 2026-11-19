import type { CSSProperties } from "react";
import type { Department } from "../departments/types";
import type { AdminUser } from "../users/types";
import type { AuditLogFilterValues } from "./types";

interface AuditLogFiltersProps {
  organizationId: string;
  users: AdminUser[];
  departments: Department[];
  values: AuditLogFilterValues;
}

/** Plain GET form: filters live in the URL, so the view stays read-only. */
export function AuditLogFilters({
  organizationId,
  users,
  departments,
  values,
}: AuditLogFiltersProps) {
  return (
    <form method="get" action="/admin/audit-log" style={formStyle}>
      <input type="hidden" name="orgId" value={organizationId} />
      <label style={fieldStyle}>
        From (UTC)
        <input
          type="datetime-local"
          name="from"
          defaultValue={toLocalInput(values.from)}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        To (UTC)
        <input
          type="datetime-local"
          name="to"
          defaultValue={toLocalInput(values.to)}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        User
        <select
          name="userId"
          defaultValue={values.userId ?? ""}
          style={inputStyle}
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        Department
        <select
          name="departmentId"
          defaultValue={values.departmentId ?? ""}
          style={inputStyle}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={buttonStyle}>
        Apply filters
      </button>
    </form>
  );
}

/** datetime-local inputs take UTC "YYYY-MM-DDTHH:mm"; filters carry ISO strings, possibly with offsets. */
function toLocalInput(value?: string): string {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 16)
    : "";
}

const formStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "flex-end",
  marginBottom: "24px",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
};

const inputStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "14px",
  background: "#fff",
};

const buttonStyle: CSSProperties = {
  padding: "8px 16px",
  border: "1px solid #2563eb",
  borderRadius: "6px",
  background: "#2563eb",
  color: "#fff",
  fontSize: "14px",
  cursor: "pointer",
};
