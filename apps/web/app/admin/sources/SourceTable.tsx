"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { fetchSourcesAction } from "./actions";
import { startSourceStatusPolling } from "./source-status-polling";
import type { Source } from "./types";

export function SourceTable({ sources }: { sources: Source[] }) {
  const [currentSources, setCurrentSources] = useState(sources);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSources(sources);
  }, [sources]);

  useEffect(
    () =>
      startSourceStatusPolling(
        fetchSourcesAction,
        (updatedSources) => {
          setCurrentSources(updatedSources);
          setRefreshError(null);
        },
        setRefreshError,
      ),
    [],
  );

  const refreshErrorAlert = refreshError ? (
    <p role="alert" style={errorStyle}>
      Status refresh failed: {refreshError}
    </p>
  ) : null;

  if (currentSources.length === 0) {
    return (
      <>
        <p style={{ color: "#6b7280" }}>No sources registered yet.</p>
        {refreshErrorAlert}
      </>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerCellStyle}>Name</th>
            <th style={headerCellStyle}>Type</th>
            <th style={headerCellStyle}>Registered</th>
            <th style={headerCellStyle}>Ingestion status</th>
            <th style={headerCellStyle}>Completed chunks</th>
          </tr>
        </thead>
        <tbody>
          {currentSources.map((source) => (
            <tr key={source.id}>
              <td style={cellStyle}>{source.name}</td>
              <td style={cellStyle}>File upload</td>
              <td style={cellStyle}>
                {new Date(source.createdAt).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                })}
              </td>
              <td style={cellStyle}>
                <span style={statusStyle[source.ingestionStatus]}>
                  {source.ingestionStatus}
                </span>
                {source.ingestionStatus === "failed" ? (
                  <p role="alert" style={errorStyle}>
                    {source.ingestionError ||
                      "No error details were recorded. Check the ingestion worker logs and retry the upload."}
                  </p>
                ) : null}
              </td>
              <td style={cellStyle}>{source.completedChunkCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {refreshErrorAlert}
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

const statusStyle: Record<Source["ingestionStatus"], CSSProperties> = {
  pending: { color: "#92400e", fontWeight: 600, textTransform: "capitalize" },
  running: { color: "#1d4ed8", fontWeight: 600, textTransform: "capitalize" },
  completed: {
    color: "#15803d",
    fontWeight: 600,
    textTransform: "capitalize",
  },
  failed: { color: "#b91c1c", fontWeight: 600, textTransform: "capitalize" },
};

const errorStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#b91c1c",
  whiteSpace: "pre-wrap",
};
