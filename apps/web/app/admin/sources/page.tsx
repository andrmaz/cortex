import type { CSSProperties } from "react";
import { fetchSources } from "./api";
import { CreateSourceForm, UploadDocumentForm } from "./SourceForms";
import { SourceTable } from "./SourceTable";
import type { Source } from "./types";

export const metadata = {
  title: "Sources — Cortex Admin",
};

export default async function SourcesPage() {
  let sources: Source[] = [];
  let error: string | null = null;

  try {
    sources = await fetchSources();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to load sources";
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Sources</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Register organization-owned knowledge sources and enqueue documents
          for ingestion.
        </p>
      </header>

      {error ? (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      ) : (
        <>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Registered sources</h2>
            <SourceTable sources={sources} />
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Register a source</h2>
            <CreateSourceForm />
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Upload a document</h2>
            <UploadDocumentForm sources={sources} />
          </section>
        </>
      )}
    </main>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  marginBottom: "32px",
  paddingBottom: "20px",
  borderBottom: "1px solid #e2e8f0",
};

const sectionStyle: CSSProperties = {
  marginBottom: "40px",
};

const sectionTitleStyle: CSSProperties = {
  marginBottom: "16px",
  color: "#111827",
  fontSize: "16px",
  fontWeight: 600,
};

const errorStyle: CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #fecaca",
  borderRadius: "6px",
  color: "#dc2626",
  background: "#fef2f2",
};
