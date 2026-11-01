"use client";

import { useActionState, useId, useState } from "react";
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
      onSubmit={(event) => {
        const parsed = parsePolicyDraft(draft);
        setValidation(parsed.error);
        if (parsed.error) event.preventDefault();
      }}
    >
      {policy ? (
        <input type="hidden" name="policyId" value={policy.id} />
      ) : (
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
      )}
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
      <div id={`${id}-feedback`} aria-live="polite">
        {validation || state.error ? (
          <p role="alert" className={styles.error}>
            {validation ?? state.error}
          </p>
        ) : null}
        {state.message && !validation ? (
          <p role="status">{state.message}</p>
        ) : null}
      </div>
      <button disabled={pending || departments.length === 0} type="submit">
        {pending
          ? "Saving…"
          : policy
            ? "Save inactive version"
            : "Create inactive version"}
      </button>
    </form>
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
        {pending ? "Updating…" : policy.isActive ? "Deactivate" : "Activate"}
      </button>
      {!policy.isActive ? (
        <>
          <label>
            <input type="checkbox" name="confirmDelete" value="yes" /> Confirm
            deletion
          </label>
          <button name="operation" value="delete" disabled={pending}>
            Delete version
          </button>
        </>
      ) : null}
      {state.error ? (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      ) : null}
      {state.message ? <p role="status">{state.message}</p> : null}
    </form>
  );
}
