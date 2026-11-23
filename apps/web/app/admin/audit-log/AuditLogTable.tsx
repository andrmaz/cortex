import type { CSSProperties } from "react";
import type { AuditLogEntry } from "./types";

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p style={{ color: "#6b7280", fontStyle: "italic" }}>
        No audit entries match these filters.
      </p>
    );
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Time</th>
          <th style={thStyle}>Actor</th>
          <th style={thStyle}>Department</th>
          <th style={thStyle}>Query</th>
          <th style={thStyle}>Details</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <AuditLogRow key={entry.id} entry={entry} />
        ))}
      </tbody>
    </table>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <tr>
      <td style={tdStyle}>{formatTime(entry.createdAt)}</td>
      <td style={tdStyle}>{entry.actor.email}</td>
      <td style={tdStyle}>{formatDepartment(entry.department)}</td>
      <td style={tdStyle}>{entry.query}</td>
      <td style={tdStyle}>
        <details>
          <summary style={{ cursor: "pointer" }}>View</summary>
          <dl style={detailListStyle}>
            <dt>Organization</dt>
            <dd>{entry.organizationId}</dd>
            <dt>Latency</dt>
            <dd>{formatLatency(entry.latencyMs)}</dd>
          </dl>
          <h3 style={subheadingStyle}>Policy decision</h3>
          <pre style={preStyle}>{formatDecision(entry.policyDecision)}</pre>
          <h3 style={subheadingStyle}>
            Context bundle ({entry.citations.length})
          </h3>
          <Citations citations={entry.citations} />
        </details>
      </td>
    </tr>
  );
}

function Citations({ citations }: { citations: AuditLogEntry["citations"] }) {
  if (citations.length === 0) {
    return <p style={{ margin: 0, color: "#6b7280" }}>No chunks returned.</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: "20px" }}>
      {citations.map((c) => (
        <li key={c.chunkId}>
          chunk {c.chunkId} · document {c.documentId} · source {c.sourceId} ·
          score {c.score.toFixed(3)}
        </li>
      ))}
    </ul>
  );
}

function formatDepartment(department: AuditLogEntry["department"]): string {
  return department ? (department.name ?? department.id) : "—";
}

function formatLatency(latencyMs: number | null): string {
  return latencyMs === null ? "—" : `${latencyMs} ms`;
}

function formatDecision(decision: AuditLogEntry["policyDecision"]): string {
  return decision === null
    ? "No decision recorded"
    : JSON.stringify(decision, null, 2);
}

function formatTime(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "2px solid #e2e8f0",
  color: "#374151",
};

const tdStyle: CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const detailListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "2px 12px",
  margin: "8px 0",
};

const subheadingStyle: CSSProperties = {
  fontSize: "13px",
  margin: "12px 0 4px",
};

const preStyle: CSSProperties = {
  margin: 0,
  padding: "8px",
  background: "#f8fafc",
  color: "#111827",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  maxWidth: "420px",
  overflow: "auto",
  fontSize: "12px",
};
