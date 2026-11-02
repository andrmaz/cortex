"use client";

import { useActionState, type CSSProperties } from "react";
import { setPolicyActiveAction } from "./actions";
import type { PolicyVersion } from "./types";

interface PolicyVersionActionsProps {
  policy: PolicyVersion;
}

type FormState = { error?: string };

export function PolicyVersionActions({ policy }: PolicyVersionActionsProps) {
  const boundAction = async (
    _previousState: FormState,
    formData: FormData,
  ): Promise<FormState> =>
    setPolicyActiveAction(policy.id, !policy.isActive, formData);

  const [state, formAction, isPending] = useActionState(boundAction, {});

  return (
    <div>
      <form action={formAction}>
        <button type="submit" disabled={isPending} style={buttonStyle}>
          {isPending
            ? "Updating…"
            : policy.isActive
              ? "Deactivate"
              : "Activate"}
        </button>
      </form>
      {state.error && (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      )}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  padding: "6px 12px",
  background: "#fff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  color: "#dc2626",
  fontSize: "12px",
  margin: "6px 0 0",
};
