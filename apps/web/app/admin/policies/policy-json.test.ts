import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner requires the explicit extension here.
// @ts-expect-error Node's native TypeScript resolution requires the .ts extension.
import { parsePolicyRulesJson } from "./policy-json.ts";

test("accepts a rules object containing only string rules", () => {
  assert.deepEqual(parsePolicyRulesJson('{"rules":["Use TypeScript"]}'), {
    value: { rules: ["Use TypeScript"] },
  });
});

test("accepts an empty rules array", () => {
  assert.deepEqual(parsePolicyRulesJson('{"rules":[]}'), {
    value: { rules: [] },
  });
});

test("rejects malformed JSON and invalid policy shapes", () => {
  for (const raw of [
    "{",
    "[]",
    "{}",
    '{"rules":"not-an-array"}',
    '{"rules":["valid",42]}',
    '{"rules":[],"extra":true}',
  ]) {
    assert.ok(parsePolicyRulesJson(raw).error, `Expected rejection for ${raw}`);
  }
});
