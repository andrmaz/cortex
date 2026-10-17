import assert from "node:assert/strict";
import test from "node:test";
// Node's native test runner resolves the TypeScript module with type stripping.
// @ts-expect-error Node's native TypeScript resolution requires the .ts extension.
import { startSourceStatusPolling } from "./source-status-polling.ts";

test("refreshes source statuses on an interval and stops after cleanup", async () => {
  let refreshCount = 0;
  let stopPolling = () => {};
  const updatedSources: { id: string; ingestionStatus: string }[] = [];
  let resolveFinished: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  stopPolling = startSourceStatusPolling(
    async () => {
      refreshCount += 1;
      return {
        sources: [{ id: "source-1", ingestionStatus: "running" }],
      };
    },
    (sources) => {
      const source = sources[0];
      assert.ok(source);
      updatedSources.push(source);
      if (updatedSources.length === 3) {
        stopPolling();
        resolveFinished();
      }
    },
    () => assert.fail("A successful refresh must not report an error"),
    5,
  );

  await finished;
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(refreshCount, 3);
  assert.deepEqual(updatedSources, [
    { id: "source-1", ingestionStatus: "running" },
    { id: "source-1", ingestionStatus: "running" },
    { id: "source-1", ingestionStatus: "running" },
  ]);
});
