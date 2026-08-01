import type { CSSProperties } from "react";
import type { Department } from "./types";

interface DeptTableProps {
  departments: Department[];
}

export function DeptTable({ departments }: DeptTableProps) {
  if (departments.length === 0) {
    return (
      <p style={{ color: "#6b7280", fontStyle: "italic" }}>
        No departments yet. Create one below.
      </p>
    );
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Name</th>
          <th style={thStyle}>ID</th>
          <th style={thStyle}>Created</th>
        </tr>
      </thead>
      <tbody>
        {departments.map((dept) => (
          <tr key={dept.id}>
            <td style={tdStyle}>
              <span style={{ fontWeight: 600 }}>{dept.name}</span>
            </td>
            <td
              style={{
                ...tdStyle,
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              {dept.id}
            </td>
            <td style={{ ...tdStyle, color: "#6b7280", fontSize: "13px" }}>
              {new Date(dept.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#f1f5f9",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#374151",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};
