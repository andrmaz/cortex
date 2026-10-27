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

export async function upsertPullRequestComment({
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
  marker,
  pullNumber,
  repository,
  summary,
  token,
}) {
  if (!repository || typeof repository !== "string") {
    throw new Error("A repository and pull request number are required");
  }
  const [owner, name, extra] = repository.split("/");
  if (
    !owner ||
    !name ||
    extra ||
    !Number.isInteger(Number(pullNumber)) ||
    Number(pullNumber) < 1
  ) {
    throw new Error("A repository and pull request number are required");
  }
  if (!token) {
    throw new Error("A GitHub token is required");
  }
  const body = { body: formatSummaryComment(marker, summary) };

  const apiRoot = `${apiUrl.replace(/\/$/, "")}/`;
  const commentsUrl = new URL(
    `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${pullNumber}/comments?per_page=100`,
    apiRoot,
  );
  let pageUrl = commentsUrl;
  let existingComment;

  while (pageUrl) {
    const response = await request(fetchImpl, pageUrl, token);
    const comments = await response.json();
    existingComment = comments.find(
      (comment) =>
        comment.user?.type === "Bot" && comment.body?.includes(marker),
    );
    if (existingComment) {
      break;
    }

    pageUrl = nextPage(response.headers.get("link"));
  }

  if (existingComment) {
    const commentUrl = new URL(
      `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/comments/${existingComment.id}`,
      apiRoot,
    );
    await request(fetchImpl, commentUrl, token, "PATCH", body);
    return "updated";
  }

  commentsUrl.search = "";
  await request(fetchImpl, commentsUrl, token, "POST", body);
  return "created";
}

async function main() {
  const {
    CI_SUMMARY_NAME,
    GITHUB_API_URL,
    GITHUB_REPOSITORY,
    GITHUB_STEP_SUMMARY,
    GITHUB_TOKEN,
    GITHUB_EVENT_PATH,
  } = process.env;

  if (!GITHUB_EVENT_PATH) {
    throw new Error("GITHUB_EVENT_PATH is required");
  }
  const event = JSON.parse(await readFile(GITHUB_EVENT_PATH, "utf8"));
  const pullNumber = event.pull_request?.number;
  if (!pullNumber) {
    return;
  }
  if (
    !CI_SUMMARY_NAME ||
    !GITHUB_REPOSITORY ||
    !GITHUB_STEP_SUMMARY ||
    !GITHUB_TOKEN
  ) {
    throw new Error("CI summary workflow environment is incomplete");
  }

  const summary = await readFile(GITHUB_STEP_SUMMARY, "utf8");
  const marker = `<!-- cortex-ci-summary:${CI_SUMMARY_NAME} -->`;
  const result = await upsertPullRequestComment({
    apiUrl: GITHUB_API_URL,
    marker,
    pullNumber,
    repository: GITHUB_REPOSITORY,
    summary,
    token: GITHUB_TOKEN,
  });
  console.log(`PR summary comment ${result} for ${CI_SUMMARY_NAME}`);
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
