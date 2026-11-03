import assert from "node:assert/strict";
import test from "node:test";
import { parsePolicyDraft } from "./editor-validation.ts";
import { mutatePolicy } from "./policy-mutation.ts";

const valid = JSON.stringify({
  schemaVersion: 1,
  allowedSourceIds: [],
  rules: [],
});

test("editor reports JSON syntax and rule shape errors, and accepts the contract", () => {
  assert.match(parsePolicyDraft("{").error ?? "", /Invalid JSON/);
  assert.match(
    parsePolicyDraft('{"schemaVersion":2}').error ?? "",
    /schemaVersion/,
  );
  assert.deepEqual(parsePolicyDraft(valid), {
    document: { schemaVersion: 1, allowedSourceIds: [], rules: [] },
  });
});

test("invalid drafts never persist and never report success", async () => {
  const form = new FormData();
  form.set("departmentId", "d1");
  form.set("rulesJson", "{");
  let calls = 0;
  const state = await mutatePolicy("create", form, async () => {
    calls++;
    return new Response();
  });
  assert.match(state.error ?? "", /Invalid JSON/);
  assert.equal(state.message, undefined);
  assert.equal(calls, 0);
});

test("server validation feedback reaches the editor without false success", async () => {
  const form = new FormData();
  form.set("departmentId", "d1");
  form.set("rulesJson", valid);
  const state = await mutatePolicy("create", form, async () =>
    Response.json(
      { message: "allowedSourceIds must reference your Organization" },
      { status: 400 },
    ),
  );
  assert.equal(
    state.error,
    "allowedSourceIds must reference your Organization",
  );
  assert.equal(state.message, undefined);
});

test("successful CRUD and activation operations return explicit feedback", async () => {
  const form = new FormData();
  form.set("departmentId", "d1");
  form.set("policyId", "p1");
  form.set("rulesJson", valid);
  form.set("confirmDelete", "yes");
  for (const [operation, path, method] of [
    ["create", "", "POST"],
    ["update", "/p1", "PATCH"],
    ["delete", "/p1", "DELETE"],
    ["activate", "/p1/activate", "POST"],
    ["deactivate", "/p1/deactivate", "POST"],
  ] as const) {
    const state = await mutatePolicy(
      operation,
      form,
      async (actualPath, actualMethod) => {
        assert.equal(actualPath, path);
        assert.equal(actualMethod, method);
        return new Response(null, { status: method === "DELETE" ? 204 : 200 });
      },
    );
    assert.ok(state.message);
    assert.equal(state.error, undefined);
  }
});

test("transport errors and unconfirmed deletion produce actionable feedback", async () => {
  const form = new FormData();
  form.set("policyId", "p1");
  const fail = async (): Promise<Response> => {
    throw new Error("offline");
  };
  assert.match(
    (await mutatePolicy("delete", form, fail)).error ?? "",
    /Confirm deletion/,
  );
  assert.match(
    (await mutatePolicy("activate", form, fail)).error ?? "",
    /connection/,
  );
});
