import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function formatSummaryComment(marker, summary) {
  const trimmedSummary = summary.trim();
  if (!marker || !trimmedSummary) {
    throw new Error("A marker and non-empty summary are required");
  }

  return `${marker}\n${trimmedSummary}`;
}

function nextPage(linkHeader) {
  const match = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1];
}

function getRepositoryParts(repository) {
  const parts = typeof repository === "string" ? repository.split("/") : [];
  const [owner, name, extra] = parts;
  const isValidRepository = [owner, name].every(Boolean) && !extra;
  if (!isValidRepository) {
    throw new Error("A repository and pull request number are required");
  }

  return { owner, name };
}

function validatePullRequestNumber(pullNumber) {
  const number = Number(pullNumber);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("A repository and pull request number are required");
  }
}

function getCommentApiRoot(apiUrl) {
  return `${apiUrl.replace(/\/$/, "")}/`;
}

function createCommentsUrl(apiRoot, owner, name, pullNumber) {
  return new URL(
    `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${pullNumber}/comments?per_page=100`,
    apiRoot,
  );
}

async function request(fetchImpl, url, token, method = "GET", body) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`GitHub comment API request failed (${response.status})`);
  }

  return response;
}

function isMarkedBotComment(comment, marker) {
  return comment.user?.type === "Bot" && comment.body?.includes(marker);
}

async function findExistingComment({ commentsUrl, fetchImpl, marker, token }) {
  let pageUrl = commentsUrl;

  while (pageUrl) {
    const response = await request(fetchImpl, pageUrl, token);
    const comments = await response.json();
    const existingComment = comments.find((comment) =>
      isMarkedBotComment(comment, marker),
    );
    if (existingComment) {
      return existingComment;
    }

    pageUrl = nextPage(response.headers.get("link"));
  }
}

async function updateComment({
  apiRoot,
  body,
  existingComment,
  fetchImpl,
  name,
  owner,
  token,
}) {
  const commentUrl = new URL(
    `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/comments/${existingComment.id}`,
    apiRoot,
  );
  await request(fetchImpl, commentUrl, token, "PATCH", body);
}

export async function upsertPullRequestComment({
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
  marker,
  pullNumber,
  repository,
  summary,
  token,
}) {
  const { owner, name } = getRepositoryParts(repository);
  validatePullRequestNumber(pullNumber);
  if (!token) {
    throw new Error("A GitHub token is required");
  }
  const body = { body: formatSummaryComment(marker, summary) };
  const apiRoot = getCommentApiRoot(apiUrl);
  const commentsUrl = createCommentsUrl(apiRoot, owner, name, pullNumber);
  const existingComment = await findExistingComment({
    commentsUrl,
    fetchImpl,
    marker,
    token,
  });

  if (existingComment) {
    await updateComment({
      apiRoot,
      body,
      existingComment,
      fetchImpl,
      name,
      owner,
      token,
    });
    return "updated";
  }

  commentsUrl.search = "";
  await request(fetchImpl, commentsUrl, token, "POST", body);
  return "created";
}

async function readPullRequestNumber(eventPath, readFileImpl) {
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required");
  }

  const event = JSON.parse(await readFileImpl(eventPath, "utf8"));
  return event.pull_request?.number;
}

function getReporterConfig(env) {
  const {
    CI_SUMMARY_NAME,
    GITHUB_API_URL,
    GITHUB_REPOSITORY,
    GITHUB_STEP_SUMMARY,
    GITHUB_TOKEN,
  } = env;

  const isConfigured = [
    CI_SUMMARY_NAME,
    GITHUB_REPOSITORY,
    GITHUB_STEP_SUMMARY,
    GITHUB_TOKEN,
  ].every(Boolean);
  if (!isConfigured) {
    throw new Error("CI summary workflow environment is incomplete");
  }

  return {
    apiUrl: GITHUB_API_URL,
    marker: `<!-- cortex-ci-summary:${CI_SUMMARY_NAME} -->`,
    repository: GITHUB_REPOSITORY,
    summaryPath: GITHUB_STEP_SUMMARY,
    summaryName: CI_SUMMARY_NAME,
    token: GITHUB_TOKEN,
  };
}

export async function runSummaryReporter({
  env = process.env,
  fetchImpl = fetch,
  logger = console,
  readFileImpl = readFile,
} = {}) {
  const pullNumber = await readPullRequestNumber(
    env.GITHUB_EVENT_PATH,
    readFileImpl,
  );
  if (!pullNumber) {
    return;
  }

  const config = getReporterConfig(env);
  const summary = await readFileImpl(config.summaryPath, "utf8");
  const result = await upsertPullRequestComment({
    apiUrl: config.apiUrl,
    fetchImpl,
    marker: config.marker,
    pullNumber,
    repository: config.repository,
    summary,
    token: config.token,
  });
  logger.log(`PR summary comment ${result} for ${config.summaryName}`);
}

async function main() {
  await runSummaryReporter();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
