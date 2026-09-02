"use client";

import { useActionState, useRef, type CSSProperties } from "react";
import { createDepartmentAction } from "./actions";

interface CreateFormProps {
  organizationId: string;
}

type FormState = { error?: string };

const initialState: FormState = {};

export function CreateDeptForm({ organizationId }: CreateFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const boundAction = async (
    _prev: FormState,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await createDepartmentAction(organizationId, formData);
    if (!result.error) {
      formRef.current?.reset();
    }
    return result;
  };

  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form ref={formRef} action={formAction} style={formStyle}>
      <h3 style={{ margin: "0 0 12px" }}>Create department</h3>

      {state.error && (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      )}

      <div style={fieldStyle}>
        <label htmlFor="create-dept-name" style={labelStyle}>
          Name
        </label>
        <input
          id="create-dept-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Engineering"
          style={inputStyle}
          disabled={isPending}
        />
      </div>

      <button type="submit" disabled={isPending} style={btnStyle}>
        {isPending ? "Creating…" : "Create"}
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
  maxWidth: "480px",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
};

const inputStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
};

const btnStyle: CSSProperties = {
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
