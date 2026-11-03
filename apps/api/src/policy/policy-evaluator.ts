import type {
  PolicyDecision,
  PolicyDocument,
  PolicyMatch,
  PolicyRule,
} from "@cortex/shared/policy";
import type { RetrievedChunk } from "../retrieval/retrieval.service";

export interface PolicyEvaluation {
  chunks: RetrievedChunk[];
  decision: PolicyDecision;
}

function literalPattern(value: string, global = false): RegExp {
  return new RegExp(
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    global ? "gi" : "i",
  );
}

function toPolicyMatch(
  rule: PolicyRule,
  field: PolicyMatch["matchedCondition"]["field"],
  subjectId?: string,
): PolicyMatch {
  const value =
    "queryContains" in rule.when
      ? rule.when.queryContains
      : rule.when.chunkContentContains;
  return {
    ruleId: rule.id,
    matchedCondition: {
      field,
      operator: "contains",
      value,
      ...(subjectId !== undefined ? { subjectId } : {}),
    },
    effect: rule.effect,
    ...(rule.effect === "deny"
      ? { reasonCode: rule.reasonCode, reason: rule.reason }
      : {}),
  };
}

function createDecision(
  policy: { id: string; version: number },
  matchedRules: PolicyMatch[],
): PolicyDecision {
  const denial = matchedRules.find((rule) => rule.effect === "deny");
  return {
    policyId: policy.id,
    policyVersion: policy.version,
    decision: denial ? "deny" : "allow",
    matchedRules,
    reasonCode: denial?.reasonCode ?? null,
    reason: denial?.reason ?? null,
  };
}

export function evaluateQueryPolicy(
  policy: { id: string; version: number },
  document: PolicyDocument,
  query: string,
): PolicyEvaluation | undefined {
  const matchedRules = document.rules.flatMap((rule) => {
    if (!("queryContains" in rule.when)) return [];
    return literalPattern(rule.when.queryContains).test(query)
      ? [toPolicyMatch(rule, "query")]
      : [];
  });
  if (!matchedRules.some((rule) => rule.effect === "deny")) return undefined;
  return { chunks: [], decision: createDecision(policy, matchedRules) };
}

export function evaluateChunkPolicy(
  policy: { id: string; version: number },
  document: PolicyDocument,
  chunks: readonly RetrievedChunk[],
): PolicyEvaluation {
  const matchedRules: PolicyMatch[] = [];
  const safeChunks = chunks.map((chunk) => {
    let content = chunk.content;
    let fileName = chunk.sourceRef.fileName;
    for (const rule of document.rules) {
      if (!("chunkContentContains" in rule.when)) continue;
      const pattern = literalPattern(rule.when.chunkContentContains);
      if (!pattern.test(chunk.content)) continue;
      matchedRules.push(toPolicyMatch(rule, "chunk.content", chunk.chunkId));
      if (rule.effect !== "redact") continue;
      content = content.replace(
        literalPattern(rule.when.chunkContentContains, true),
        () => rule.replacement,
      );
      fileName = fileName?.replace(
        literalPattern(rule.when.chunkContentContains, true),
        () => rule.replacement,
      );
    }
    return {
      ...chunk,
      content,
      sourceRef: {
        ...chunk.sourceRef,
        ...(fileName !== undefined ? { fileName } : {}),
      },
    };
  });
  const result = createDecision(policy, matchedRules);
  return {
    chunks: result.decision === "deny" ? [] : safeChunks,
    decision: result,
  };
}
