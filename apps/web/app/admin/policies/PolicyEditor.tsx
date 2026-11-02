"use client";

import { useActionState, useId, useState, type FormEvent } from "react";
import type { Department } from "../departments/types";
import type { Policy, PolicyActionState } from "./types";
import { savePolicyAction, lifecyclePolicyAction } from "./actions";
import { parsePolicyDraft } from "./editor-validation";
import styles from "./policies.module.css";

const template = JSON.stringify(
  { schemaVersion: 1, allowedSourceIds: [], rules: [] },
  null,
  2,
);
const initialState: PolicyActionState = {};

function validateDraft(
  event: FormEvent<HTMLFormElement>,
  draft: string,
  setValidation: (error: string | undefined) => void,
): void {
  const parsed = parsePolicyDraft(draft);
  setValidation(parsed.error);
  if (parsed.error) event.preventDefault();
}

function DepartmentField({
  policy,
  departments,
  id,
}: {
  policy?: Policy;
  departments: Department[];
  id: string;
}) {
  if (policy) return <input type="hidden" name="policyId" value={policy.id} />;
  return (
    <label htmlFor={`${id}-department`}>
      Department
      <select
        id={`${id}-department`}
        name="departmentId"
        required
        defaultValue=""
      >
        <option value="" disabled>
          Select a Department
        </option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditorFeedback({
  validation,
  state,
  id,
}: {
  validation?: string;
  state: PolicyActionState;
  id: string;
}) {
  return (
    <div id={`${id}-feedback`} aria-live="polite">
      <EditorError validation={validation} error={state.error} />
      <EditorStatus validation={validation} message={state.message} />
    </div>
  );
}

function EditorError({
  validation,
  error,
}: {
  validation?: string;
  error?: string;
}) {
  const message = validation ?? error;
  return message ? (
    <p role="alert" className={styles.error}>
      {message}
    </p>
  ) : null;
}

function EditorStatus({
  validation,
  message,
}: {
  validation?: string;
  message?: string;
}) {
  if (!message || validation) return null;
  return <p role="status">{message}</p>;
}

function saveButtonLabel(pending: boolean, editing: boolean): string {
  if (pending) return "Saving…";
  return editing ? "Save inactive version" : "Create inactive version";
}

export function PolicyEditor({
  departments,
  policy,
}: {
  departments: Department[];
  policy?: Policy;
}) {
  const id = useId();
  const [draft, setDraft] = useState(
    policy ? JSON.stringify(policy.rulesJson, null, 2) : template,
  );
  const [validation, setValidation] = useState<string>();
  const [state, action, pending] = useActionState(
    savePolicyAction,
    initialState,
  );
  return (
    <form
      action={action}
      className={styles.form}
      onSubmit={(event) => validateDraft(event, draft, setValidation)}
    >
      <DepartmentField policy={policy} departments={departments} id={id} />
      <label htmlFor={`${id}-rules`}>Policy JSON</label>
      <textarea
        id={`${id}-rules`}
        name="rulesJson"
        value={draft}
        rows={14}
        spellCheck={false}
        aria-invalid={Boolean(validation || state.error)}
        aria-describedby={`${id}-help ${id}-feedback`}
        onChange={(event) => {
          setDraft(event.target.value);
          setValidation(undefined);
        }}
        onBlur={() => setValidation(parsePolicyDraft(draft).error)}
      />
      <p id={`${id}-help`} className={styles.help}>
        Empty allowedSourceIds permits no sources. Rules use literal,
        case-insensitive contains matching; deny blocks the whole request.
      </p>
      <EditorFeedback validation={validation} state={state} id={id} />
      <button disabled={pending || departments.length === 0} type="submit">
        {saveButtonLabel(pending, Boolean(policy))}
      </button>
    </form>
  );
}

function lifecycleButtonLabel(pending: boolean, active: boolean): string {
  if (pending) return "Updating…";
  return active ? "Deactivate" : "Activate";
}

function DeletionControls({
  policy,
  pending,
}: {
  policy: Policy;
  pending: boolean;
}) {
  if (policy.isActive) return null;
  return (
    <>
      <label>
        <input type="checkbox" name="confirmDelete" value="yes" /> Confirm
        deletion
      </label>
      <button name="operation" value="delete" disabled={pending}>
        Delete version
      </button>
    </>
  );
}

function LifecycleFeedback({ state }: { state: PolicyActionState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      ) : null}
      {state.message ? <p role="status">{state.message}</p> : null}
    </>
  );
}

export function PolicyLifecycle({ policy }: { policy: Policy }) {
  const [state, action, pending] = useActionState(
    lifecyclePolicyAction,
    initialState,
  );
  return (
    <form action={action} className={styles.lifecycle}>
      <input type="hidden" name="policyId" value={policy.id} />
      <button
        name="operation"
        value={policy.isActive ? "deactivate" : "activate"}
        disabled={pending}
      >
        {lifecycleButtonLabel(pending, policy.isActive)}
      </button>
      <DeletionControls policy={policy} pending={pending} />
      <LifecycleFeedback state={state} />
    </form>
  );
}
