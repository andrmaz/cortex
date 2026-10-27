import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSummaryComment,
  upsertPullRequestComment,
} from "../.github/scripts/ci-pr-summary.mjs";

test("formats a stable workflow marker around the job summary", () => {
  assert.equal(
    formatSummaryComment("<!-- cortex-ci-summary:main -->", "## CI\n\nPassed."),
    "<!-- cortex-ci-summary:main -->\n## CI\n\nPassed.",
  );
});

test("updates the existing bot comment instead of creating a duplicate", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    if (options.method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: 17,
            body: "<!-- cortex-ci-summary:main -->\nold",
            user: { type: "Bot" },
          },
        ]),
        { status: 200 },
      );
    }

    return new Response("{}", { status: 200 });
  };

  await upsertPullRequestComment({
    apiUrl: "https://api.github.com",
    fetchImpl,
    marker: "<!-- cortex-ci-summary:main -->",
    pullNumber: 42,
    repository: "andrmaz/cortex",
    summary: "## CI\n\nPassed.",
    token: "test-token",
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.method, "PATCH");
  assert.equal(
    requests[1].url,
    "https://api.github.com/repos/andrmaz/cortex/issues/comments/17",
  );
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    body: "<!-- cortex-ci-summary:main -->\n## CI\n\nPassed.",
  });
});

test("creates a comment when the workflow has not posted one before", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(options.method === "GET" ? "[]" : "{}", {
      status: options.method === "GET" ? 200 : 201,
    });
  };

  await upsertPullRequestComment({
    apiUrl: "https://api.github.com",
    fetchImpl,
    marker: "<!-- cortex-ci-summary:codeql -->",
    pullNumber: 42,
    repository: "andrmaz/cortex",
    summary: "## CodeQL\n\nPassed.",
    token: "test-token",
  });

  assert.equal(requests[1].options.method, "POST");
  assert.equal(
    requests[1].url,
    "https://api.github.com/repos/andrmaz/cortex/issues/42/comments",
  );
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    body: "<!-- cortex-ci-summary:codeql -->\n## CodeQL\n\nPassed.",
  });
});
