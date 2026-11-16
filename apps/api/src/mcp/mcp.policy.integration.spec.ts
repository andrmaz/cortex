import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { DeterministicEmbeddingProvider } from "../ingestion/embedding.provider";
import type { PolicyDocument } from "@cortex/shared/policy";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import { MCPController, type RequestWithJwtUser } from "./mcp.controller";
import { IdentityService } from "./identity.service";
import { ContextBundleService } from "./context-bundle.service";
import { RetrievalService } from "../retrieval/retrieval.service";
import { QueryLogService } from "./query-log.service";
import { PolicyRuntimeService } from "../policy/policy-runtime.service";

const user: AuthenticatedUser = {
  id: "user-1",
  email: "member@example.test",
  organizationId: "org-1",
  role: "member",
};

const rows = [
  {
    chunkId: "chunk-allowed",
    content: "The secret launch date is tomorrow.",
    documentId: "doc-allowed",
    sourceId: "source-allowed",
    documentMetadata: { fileName: "secret-plan.txt" },
    score: 0.9,
  },
  {
    chunkId: "chunk-forbidden",
    content: "Another department's private note.",
    documentId: "doc-forbidden",
    sourceId: "source-forbidden",
    documentMetadata: { fileName: "private.txt" },
    score: 0.8,
  },
];

function setup(policyDocument: unknown, searchRows = rows) {
  const findActivePolicy = vi
    .fn()
    .mockResolvedValue(
      policyDocument === null
        ? null
        : { id: "policy-1", version: 3, rulesJson: policyDocument },
    );
  const searchChunks = vi.fn(
    async (params: { allowedSourceIds?: readonly string[] }) =>
      searchRows.filter(
        (row) =>
          params.allowedSourceIds === undefined ||
          params.allowedSourceIds.includes(row.sourceId),
      ),
  );
  const prisma = fromPartial<PrismaService>({
    policy: fromPartial<PrismaService["policy"]>({
      findFirst: findActivePolicy,
    }),
    searchChunksBySimilarity: searchChunks,
  });
  const identity = fromPartial<IdentityService>({
    resolveScope: vi.fn().mockResolvedValue({
      organizationId: "org-1",
      departmentId: "dept-1",
    }),
  });
  const retrieval = new RetrievalService(
    prisma,
    new DeterministicEmbeddingProvider(),
  );
  const runtime = new PolicyRuntimeService(prisma, retrieval);
  const controller = new MCPController(
    identity,
    runtime,
    new ContextBundleService(),
    fromPartial<QueryLogService>({ record: vi.fn() }),
  );
  const req = fromPartial<RequestWithJwtUser>({ user });
  return { controller, req, findActivePolicy, searchChunks };
}

describe("MCP policy request path", () => {
  it("filters Sources before retrieval and redacts content and citation metadata", async () => {
    const policy: PolicyDocument = {
      schemaVersion: 1,
      allowedSourceIds: ["source-allowed"],
      rules: [
        {
          id: "mask-secret",
          when: { chunkContentContains: "secret" },
          effect: "redact",
          replacement: "[REDACTED]",
        },
      ],
    };
    const { controller, req, findActivePolicy, searchChunks } = setup(policy);

    const result = await controller.handleMCP({ query: "launch" }, req);
    expect(req.policyDecision).toBe(result.policy);
    const repeated = await controller.handleMCP({ query: "launch" }, req);

    expect(findActivePolicy).toHaveBeenCalledTimes(2);
    expect(findActivePolicy).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        departmentId: "dept-1",
        isActive: true,
      },
    });
    expect(searchChunks).toHaveBeenCalledWith(
      expect.objectContaining({ allowedSourceIds: ["source-allowed"] }),
    );
    expect(result.context).toEqual(["The [REDACTED] launch date is tomorrow."]);
    expect(result.citations).toHaveLength(1);
    expect(JSON.stringify(result.citations)).not.toContain("secret");
    expect(result.policy.decision).toBe("redact");
    expect(result.policy.matchedRules.map((rule) => rule.ruleId)).toEqual([
      "mask-secret",
    ]);
    expect(req.policyDecision).toBe(repeated.policy);
  });

  it("redacts a matching file name when the Chunk content does not match", async () => {
    const { controller, req } = setup(
      {
        schemaVersion: 1,
        allowedSourceIds: ["source-allowed"],
        rules: [
          {
            id: "mask-secret",
            when: { chunkContentContains: "secret" },
            effect: "redact",
            replacement: "[REDACTED]",
          },
        ],
      },
      [{ ...rows[0], content: "Quarterly planning notes." }],
    );

    const result = await controller.handleMCP({ query: "planning" }, req);

    expect(result.context).toEqual(["Quarterly planning notes."]);
    expect(result.citations[0]?.fileName).toBe("[REDACTED]-plan.txt");
    expect(result.policy.matchedRules).toEqual([
      expect.objectContaining({
        ruleId: "mask-secret",
        matchedCondition: expect.objectContaining({
          field: "source.fileName",
        }),
      }),
    ]);
  });

  it("does not echo a query when no permitted context is available", async () => {
    const { controller, req } = setup({
      schemaVersion: 1,
      allowedSourceIds: [],
      rules: [],
    });

    const result = await controller.handleMCP(
      { query: "private query that must not be echoed" },
      req,
    );

    expect(result.context).toEqual([]);
    expect(result.citations).toEqual([]);
    expect(result.answer).toBe("No relevant context found.");
    expect(result.answer).not.toContain("private query");
  });

  it("denies a matching query before retrieval and attaches the decision", async () => {
    const { controller, req, searchChunks } = setup({
      schemaVersion: 1,
      allowedSourceIds: ["source-allowed"],
      rules: [
        {
          id: "deny-payroll",
          when: { queryContains: "salary" },
          effect: "deny",
          reasonCode: "PAYROLL_RESTRICTED",
          reason: "Payroll queries are restricted.",
        },
      ],
    });

    const result = await controller.handleMCP(
      { query: "salary for Alice" },
      req,
    );

    expect(result.policy.decision).toBe("deny");
    expect(result.policy.reasonCode).toBe("PAYROLL_RESTRICTED");
    expect(result.context).toEqual([]);
    expect(result.citations).toEqual([]);
    expect(result.answer).toBe("Payroll queries are restricted.");
    expect(searchChunks).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("Alice");
    expect(req.policyDecision).toBe(result.policy);
  });

  it("suppresses the entire Context Bundle when retrieved content is denied", async () => {
    const { controller, req } = setup({
      schemaVersion: 1,
      allowedSourceIds: ["source-allowed"],
      rules: [
        {
          id: "deny-launch-details",
          when: { chunkContentContains: "launch date" },
          effect: "deny",
          reasonCode: "LAUNCH_RESTRICTED",
          reason: "Launch details are restricted.",
        },
      ],
    });

    const result = await controller.handleMCP({ query: "launch" }, req);

    expect(result.policy.decision).toBe("deny");
    expect(result.policy.matchedRules[0]?.ruleId).toBe("deny-launch-details");
    expect(result.context).toEqual([]);
    expect(result.citations).toEqual([]);
    expect(result.answer).toBe("Launch details are restricted.");
  });

  it("fails closed when the caller's Department has no active Policy", async () => {
    const { controller, req, searchChunks } = setup(null);

    const result = await controller.handleMCP({ query: "launch" }, req);

    expect(result.policy.decision).toBe("deny");
    expect(result.policy.reasonCode).toBe("POLICY_NO_ACTIVE_POLICY");
    expect(result.context).toEqual([]);
    expect(searchChunks).not.toHaveBeenCalled();
  });
});
