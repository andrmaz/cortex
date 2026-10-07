import type { CSSProperties } from "react";
import type { Source } from "./types";

export function SourceTable({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return <p style={{ color: "#6b7280" }}>No sources registered yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerCellStyle}>Name</th>
            <th style={headerCellStyle}>Type</th>
            <th style={headerCellStyle}>Registered</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id}>
              <td style={cellStyle}>{source.name}</td>
              <td style={cellStyle}>File upload</td>
              <td style={cellStyle}>
                {new Date(source.createdAt).toLocaleDateString()}
              </td>
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

const headerCellStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "2px solid #e2e8f0",
  color: "#374151",
  textAlign: "left",
};

const cellStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#111827",
};
