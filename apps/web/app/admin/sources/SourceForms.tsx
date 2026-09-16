"use client";

import { useActionState, useRef, type CSSProperties } from "react";
import {
  createSourceAction,
  uploadDocumentAction,
  type SourceActionState,
} from "./actions";
import type { Source } from "./types";

const initialState: SourceActionState = {};

export function CreateSourceForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (
    _previous: SourceActionState,
    formData: FormData,
  ): Promise<SourceActionState> => {
    const result = await createSourceAction(formData);
    if (!result.error) {
      formRef.current?.reset();
    }
    return result;
  };

  const [state, action, isPending] = useActionState(submit, initialState);

  return (
    <form ref={formRef} action={action} style={formStyle}>
      <div style={fieldStyle}>
        <label htmlFor="source-name" style={labelStyle}>
          Source name
        </label>
        <input
          id="source-name"
          name="name"
          type="text"
          required
          disabled={isPending}
          placeholder="e.g. Employee handbook"
          style={inputStyle}
        />
      </div>
      <div style={fieldStyle}>
        <span style={labelStyle}>Type</span>
        <span style={readOnlyStyle}>File upload</span>
      </div>
      <Status state={state} />
      <button type="submit" disabled={isPending} style={buttonStyle}>
        {isPending ? "Registering…" : "Register source"}
      </button>
    </form>
  );
}

export function UploadDocumentForm({ sources }: { sources: Source[] }) {
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (
    _previous: SourceActionState,
    formData: FormData,
  ): Promise<SourceActionState> => {
    const sourceId = getSelectedSourceId(formData);
    const result = await uploadDocumentAction(sourceId, formData);
    if (!result.error) {
      formRef.current?.reset();
    }
    return result;
  };

  const [state, action, isPending] = useActionState(submit, initialState);
  const hasSources = sources.length > 0;

  return (
    <form ref={formRef} action={action} style={formStyle}>
      <div style={fieldStyle}>
        <label htmlFor="upload-source" style={labelStyle}>
          Source
        </label>
        <select
          id="upload-source"
          name="sourceId"
          required
          disabled={isPending || !hasSources}
          style={inputStyle}
        >
          <option value="">Select a source…</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>
      <div style={fieldStyle}>
        <label htmlFor="source-file" style={labelStyle}>
          Document
        </label>
        <input
          id="source-file"
          name="file"
          type="file"
          required
          accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
          disabled={isPending || !hasSources}
          style={inputStyle}
        />
        <small style={{ color: "#6b7280" }}>
          Plain text, Markdown, CSV, or JSON; maximum 10 MB.
        </small>
      </div>
      <Status state={state} />
      <button
        type="submit"
        disabled={isPending || !hasSources}
        style={buttonStyle}
      >
        {isPending ? "Uploading…" : "Upload and enqueue"}
      </button>
      {!hasSources ? (
        <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
          Register a source before uploading a document.
        </p>
      ) : null}
    </form>
  );
}

function Status({ state }: { state: SourceActionState }) {
  if (state.error) {
    return (
      <p role="alert" style={errorStyle}>
        {state.error}
      </p>
    );
  }
  return state.message ? (
    <p role="status" style={successStyle}>
      {state.message}
    </p>
  ) : null;
}

function getSelectedSourceId(formData: FormData): string {
  const value = formData.get("sourceId");
  return typeof value === "string" ? value : "";
}

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "520px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelStyle: CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  background: "#fff",
  fontSize: "14px",
};

const readOnlyStyle: CSSProperties = {
  ...inputStyle,
  color: "#4b5563",
  background: "#f1f5f9",
};

const buttonStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "8px 16px",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  background: "#2563eb",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
};

const errorStyle: CSSProperties = {
  margin: 0,
  padding: "8px 12px",
  border: "1px solid #fecaca",
  borderRadius: "6px",
  color: "#dc2626",
  background: "#fef2f2",
  fontSize: "13px",
};

const successStyle: CSSProperties = {
  ...errorStyle,
  borderColor: "#bbf7d0",
  color: "#15803d",
  background: "#f0fdf4",
};
