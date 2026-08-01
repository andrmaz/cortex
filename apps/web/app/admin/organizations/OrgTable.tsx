"use client";

import { useState, type CSSProperties } from "react";
import type { Organization } from "./types";
import { EditOrgForm } from "./OrgForm";

interface OrgTableProps {
  orgs: Organization[];
}

export function OrgTable({ orgs }: OrgTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (orgs.length === 0) {
    return (
      <p style={{ color: "#6b7280", fontStyle: "italic" }}>
        No organizations yet. Create one below.
      </p>
    );
  }

  return (
    <div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => (
            <tr key={org.id}>
              {editingId === org.id ? (
                <td colSpan={4} style={tdStyle}>
                  <EditOrgForm
                    org={org}
                    onDone={() => setEditingId(null)}
                  />
                </td>
              ) : (
                <>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{org.name}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px", color: "#6b7280" }}>
                    {org.id}
                  </td>
                  <td style={{ ...tdStyle, color: "#6b7280", fontSize: "13px" }}>
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setEditingId(org.id)}
                      style={editBtnStyle}
                    >
                      Edit
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

const editBtnStyle: CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  color: "#2563eb",
  border: "1px solid #2563eb",
  borderRadius: "4px",
  fontSize: "13px",
  cursor: "pointer",
};
