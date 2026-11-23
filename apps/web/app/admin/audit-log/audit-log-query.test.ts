import assert from "node:assert/strict";
import test from "node:test";
// Node's native test runner resolves the TypeScript module with type stripping.
import { buildAuditLogQuery, toUtcIso } from "./audit-log-query.ts";

test("buildAuditLogQuery keeps only set filters", () => {
  assert.equal(buildAuditLogQuery({}), "");
  assert.equal(
    buildAuditLogQuery({ userId: "u 1", departmentId: "", from: undefined }),
    "?userId=u+1",
  );
});

test("toUtcIso adds a UTC offset to datetime-local values only", () => {
  assert.equal(toUtcIso(undefined), undefined);
  assert.equal(toUtcIso(""), undefined);
  assert.equal(toUtcIso("2024-06-01T10:30"), "2024-06-01T10:30:00Z");
  assert.equal(toUtcIso("2024-06-01T10:30:59"), "2024-06-01T10:30:59Z");
  assert.equal(toUtcIso("2024-06-01T10:30:00Z"), "2024-06-01T10:30:00Z");
});
