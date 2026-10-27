import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSummaryComment,
  runSummaryReporter,
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

test("updates a matching bot comment found on a later comments page", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    if (options.method === "GET" && requests.length === 1) {
      return new Response(
        JSON.stringify([
          {
            id: 8,
            body: "<!-- cortex-ci-summary:main -->\nnot a bot comment",
            user: { type: "User" },
          },
        ]),
        {
          headers: {
            link: '<https://api.github.com/repos/andrmaz/cortex/issues/42/comments?per_page=100&page=2>; rel="next"',
          },
          status: 200,
        },
      );
    }
    if (options.method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: 19,
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

  assert.equal(requests.length, 3);
  assert.equal(requests[1].url.includes("page=2"), true);
  assert.equal(requests[2].options.method, "PATCH");
  assert.match(requests[2].url, /issues\/comments\/19$/);
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

test("does not publish a summary for a non-pull-request event", async () => {
  const reads = [];

  await runSummaryReporter({
    env: { GITHUB_EVENT_PATH: "event.json" },
    fetchImpl: async () => {
      throw new Error("A non-pull-request event must not call GitHub");
    },
    readFileImpl: async (path) => {
      reads.push(path);
      return JSON.stringify({});
    },
  });

  assert.deepEqual(reads, ["event.json"]);
});

test("publishes the step summary for a pull-request event", async () => {
  const reads = [];
  const requests = [];
  const messages = [];

  await runSummaryReporter({
    env: {
      CI_SUMMARY_NAME: "fallow-startup",
      GITHUB_API_URL: "https://api.github.com",
      GITHUB_EVENT_PATH: "event.json",
      GITHUB_REPOSITORY: "andrmaz/cortex",
      GITHUB_STEP_SUMMARY: "summary.md",
      GITHUB_TOKEN: "test-token",
    },
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(options.method === "GET" ? "[]" : "{}", {
        status: options.method === "GET" ? 200 : 201,
      });
    },
    logger: { log: (message) => messages.push(message) },
    readFileImpl: async (path) => {
      reads.push(path);
      if (path === "event.json") {
        return JSON.stringify({ pull_request: { number: 42 } });
      }
      return "## Fallow summary\n\nAudit failed before reporting.";
    },
  });

  assert.deepEqual(reads, ["event.json", "summary.md"]);
  assert.equal(requests[1].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    body: "<!-- cortex-ci-summary:fallow-startup -->\n## Fallow summary\n\nAudit failed before reporting.",
  });
  assert.deepEqual(messages, ["PR summary comment created for fallow-startup"]);
});
