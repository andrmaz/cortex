import { describe, expect, it } from "vitest";
import type { PolicyDocument } from "@cortex/shared/policy";
import { evaluateChunkPolicy, evaluateQueryPolicy } from "./policy-evaluator";

const policy = { id: "p1", version: 2 };

const chunk = (chunkId: string, content: string) => ({
  chunkId,
  content,
  score: 1,
  sourceRef: { sourceId: "s1", documentId: "d1" },
});

const condition = (value: string, subjectId: string) => ({
  field: "chunk.content" as const,
  operator: "contains" as const,
  value,
  subjectId,
});

describe("Policy Decision reason traces", () => {
  it("returns an exact allow trace when no rule matches", () => {
    const document: PolicyDocument = {
      schemaVersion: 1,
      allowedSourceIds: ["s1"],
      rules: [],
    };

    expect(
      evaluateChunkPolicy(policy, document, [chunk("c1", "hello")]).decision,
    ).toEqual({
      policyId: "p1",
      policyVersion: 2,
      decision: "allow",
      matchedRules: [],
      reasonCode: null,
      reason: null,
    });
  });

  it("returns an exact redact trace without summary reasons", () => {
    const document: PolicyDocument = {
      schemaVersion: 1,
      allowedSourceIds: ["s1"],
      rules: [
        {
          id: "mask",
          when: { chunkContentContains: "secret" },
          effect: "redact",
          replacement: "[MASK]",
        },
      ],
    };

    const result = evaluateChunkPolicy(policy, document, [
      chunk("c1", "a secret"),
    ]);

    expect(result.chunks[0]?.content).toBe("a [MASK]");
    expect(result.decision).toEqual({
      policyId: "p1",
      policyVersion: 2,
      decision: "redact",
      matchedRules: [
        {
          ruleId: "mask",
          matchedCondition: condition("secret", "c1"),
          decision: "redact",
        },
      ],
      reasonCode: null,
      reason: null,
    });
    expect(JSON.stringify(result.decision)).not.toContain("a secret");
  });

  it("returns an exact query deny trace with a machine code and human reason", () => {
    const document: PolicyDocument = {
      schemaVersion: 1,
      allowedSourceIds: ["s1"],
      rules: [
        {
          id: "deny-finance",
          when: { queryContains: "finance" },
          effect: "deny",
          reasonCode: "FINANCE_DENIED",
          reason: "Finance is restricted.",
        },
      ],
    };

    const result = evaluateQueryPolicy(policy, document, "FINANCE please");

    expect(result).toEqual({
      chunks: [],
      decision: {
        policyId: "p1",
        policyVersion: 2,
        decision: "deny",
        matchedRules: [
          {
            ruleId: "deny-finance",
            matchedCondition: {
              field: "query",
              operator: "contains",
              value: "finance",
            },
            decision: "deny",
            reasonCode: "FINANCE_DENIED",
            reason: "Finance is restricted.",
          },
        ],
        reasonCode: "FINANCE_DENIED",
        reason: "Finance is restricted.",
      },
    });
    expect(JSON.stringify(result?.decision)).not.toContain("please");
  });

  it("gives deny precedence and preserves rule then Chunk order", () => {
    const document: PolicyDocument = {
      schemaVersion: 1,
      allowedSourceIds: ["s1"],
      rules: [
        {
          id: "mask",
          when: { chunkContentContains: "secret" },
          effect: "redact",
          replacement: "[MASK]",
        },
        {
          id: "deny",
          when: { chunkContentContains: "secret" },
          effect: "deny",
          reasonCode: "SECRET_DENIED",
          reason: "Restricted.",
        },
      ],
    };

    const result = evaluateChunkPolicy(policy, document, [
      chunk("c2", "SECRET"),
      chunk("c1", "SECRET"),
    ]);

    expect(result.chunks).toEqual([]);
    expect(result.decision.decision).toBe("deny");
    expect(result.decision.reasonCode).toBe("SECRET_DENIED");
    expect(
      result.decision.matchedRules.map((m) => [
        m.ruleId,
        m.matchedCondition.subjectId,
      ]),
    ).toEqual([
      ["mask", "c2"],
      ["mask", "c1"],
      ["deny", "c2"],
      ["deny", "c1"],
    ]);
  });
});
