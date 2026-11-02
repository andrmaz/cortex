"use client";

import { useActionState, useRef, useState, type CSSProperties } from "react";
import { createPolicyAction } from "./actions";
import { parsePolicyRulesJson } from "./policy-json";

interface PolicyEditorProps {
  departmentId: string;
}

type FormState = { error?: string };

const initialState: FormState = {};
const initialPolicyJson = '{\n  "rules": []\n}';

export function PolicyEditor({ departmentId }: PolicyEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [jsonText, setJsonText] = useState(initialPolicyJson);
  const parsed = parsePolicyRulesJson(jsonText);

  const boundAction = async (
    _previousState: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await createPolicyAction(departmentId, formData);
    if (!result.error) {
      formRef.current?.reset();
      setJsonText(initialPolicyJson);
    }
    return result;
  };

  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form ref={formRef} action={formAction} style={formStyle}>
      <h3 style={{ margin: "0 0 4px" }}>Create policy version</h3>
      <p style={descriptionStyle}>
        Each save creates a new inactive version. Activate it when it is ready.
      </p>

      <label htmlFor="policy-rules-json" style={labelStyle}>
        Policy JSON
      </label>
      <textarea
        id="policy-rules-json"
        name="rulesJson"
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        rows={10}
        spellCheck={false}
        disabled={isPending}
        style={textareaStyle}
      />

      {parsed.error && (
        <p role="alert" style={errorStyle}>
          {parsed.error}
        </p>
      )}
      {state.error && (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || Boolean(parsed.error)}
        style={buttonStyle}
      >
        {isPending ? "Saving…" : "Create inactive version"}
      </button>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "20px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
  maxWidth: "640px",
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: "13px",
};

const labelStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontFamily: "monospace",
  fontSize: "13px",
  lineHeight: 1.5,
};

const buttonStyle: CSSProperties = {
  padding: "8px 16px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  alignSelf: "flex-start",
};

const errorStyle: CSSProperties = {
  color: "#dc2626",
  fontSize: "13px",
  margin: 0,
  padding: "8px 12px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "6px",
};
