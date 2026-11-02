import type { CSSProperties } from "react";
import { PolicyVersionActions } from "./PolicyVersionActions";
import type { PolicyVersion } from "./types";

interface PolicyHistoryProps {
  policies: PolicyVersion[];
}

export function PolicyHistory({ policies }: PolicyHistoryProps) {
  if (policies.length === 0) {
    return (
      <p style={{ color: "#6b7280", fontStyle: "italic" }}>
        No policy versions yet. Create the first version below.
      </p>
    );
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Version</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Rules JSON</th>
          <th style={thStyle}>Created</th>
          <th style={thStyle}>Action</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => (
          <tr key={policy.id}>
            <td style={tdStyle}>v{policy.version}</td>
            <td style={tdStyle}>{policy.isActive ? "Active" : "Inactive"}</td>
            <td style={rulesStyle}>
              {JSON.stringify(policy.rulesJson, null, 2)}
            </td>
            <td style={tdStyle}>
              {new Date(policy.createdAt).toLocaleDateString()}
            </td>
            <td style={tdStyle}>
              <PolicyVersionActions policy={policy} />
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

const rulesStyle: CSSProperties = {
  ...tdStyle,
  maxWidth: "360px",
  fontFamily: "monospace",
  fontSize: "12px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};
