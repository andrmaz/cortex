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

interface ChunkState {
  content: string;
  fileName: string | undefined;
  matchedRules: PolicyMatch[];
}

interface EvaluatedChunk {
  chunk: RetrievedChunk;
  matchedRules: PolicyMatch[];
}

type RedactRule = Extract<PolicyRule, { effect: "redact" }>;

/** Builds a case-insensitive literal (regex-escaped) matcher. */
function literalPattern(value: string, global = false): RegExp {
  return new RegExp(
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    global ? "gi" : "i",
  );
}

/** Creates a trace entry describing the configured condition, never the matched payload. */
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
    decision: rule.effect,
    ...(rule.effect === "deny"
      ? { reasonCode: rule.reasonCode, reason: rule.reason }
      : {}),
  };
}

/** Builds the summary decision: deny takes precedence, then redact, else allow. */
function createDecision(
  policy: { id: string; version: number },
  matchedRules: PolicyMatch[],
): PolicyDecision {
  const denial = matchedRules.find((rule) => rule.decision === "deny");
  const redacted = matchedRules.some((rule) => rule.decision === "redact");
  return {
    policyId: policy.id,
    policyVersion: policy.version,
    decision: denial ? "deny" : redacted ? "redact" : "allow",
    matchedRules,
    reasonCode: denial?.reasonCode ?? null,
    reason: denial?.reason ?? null,
  };
}

/** Records a deny match for a Chunk whose content matched the rule. */
function recordDenyMatch(
  chunk: RetrievedChunk,
  rule: Extract<PolicyRule, { effect: "deny" }>,
  contentMatches: boolean,
  state: ChunkState,
): void {
  if (!contentMatches) return;
  state.matchedRules.push(toPolicyMatch(rule, "chunk.content", chunk.chunkId));
}

/** Records a redact match and applies the replacement to content and file name. */
function applyRedactRule(
  chunk: RetrievedChunk,
  rule: RedactRule,
  value: string,
  contentMatches: boolean,
  state: ChunkState,
): void {
  const fileNameMatches =
    state.fileName !== undefined && literalPattern(value).test(state.fileName);
  if (!contentMatches && !fileNameMatches) return;
  state.matchedRules.push(
    toPolicyMatch(
      rule,
      contentMatches ? "chunk.content" : "source.fileName",
      chunk.chunkId,
    ),
  );
  if (contentMatches) {
    state.content = state.content.replace(
      literalPattern(value, true),
      () => rule.replacement,
    );
  }
  if (fileNameMatches) {
    state.fileName = state.fileName?.replace(
      literalPattern(value, true),
      () => rule.replacement,
    );
  }
}

/** Dispatches a rule to its deny or redact handler when it targets Chunk content. */
function applyChunkRule(
  chunk: RetrievedChunk,
  rule: PolicyRule,
  state: ChunkState,
): void {
  if (!("chunkContentContains" in rule.when)) return;
  const value = rule.when.chunkContentContains;
  const contentMatches = literalPattern(value).test(chunk.content);
  if (rule.effect === "deny") {
    recordDenyMatch(chunk, rule, contentMatches, state);
    return;
  }
  applyRedactRule(chunk, rule, value, contentMatches, state);
}

/** Applies every rule to one Chunk, returning a redacted copy and its ordered matches. */
function evaluateChunkRules(
  chunk: RetrievedChunk,
  rules: readonly PolicyRule[],
): EvaluatedChunk {
  const state: ChunkState = {
    content: chunk.content,
    fileName: chunk.sourceRef.fileName,
    matchedRules: [],
  };
  for (const rule of rules) {
    applyChunkRule(chunk, rule, state);
  }
  return {
    chunk: {
      ...chunk,
      content: state.content,
      sourceRef: {
        ...chunk.sourceRef,
        ...(state.fileName !== undefined ? { fileName: state.fileName } : {}),
      },
    },
    matchedRules: state.matchedRules,
  };
}

/** Evaluates query rules; returns a deny evaluation, or undefined when no query rule denies. */
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
  if (!matchedRules.some((rule) => rule.decision === "deny")) return undefined;
  return { chunks: [], decision: createDecision(policy, matchedRules) };
}

/** Evaluates Chunk rules for the retrieved Chunks; deny clears all Chunks, redact rewrites copies. */
export function evaluateChunkPolicy(
  policy: { id: string; version: number },
  document: PolicyDocument,
  chunks: readonly RetrievedChunk[],
): PolicyEvaluation {
  const evaluatedChunks = chunks.map((chunk) =>
    evaluateChunkRules(chunk, document.rules),
  );
  const matchedRules = document.rules.flatMap((rule) =>
    evaluatedChunks.flatMap((evaluatedChunk) =>
      evaluatedChunk.matchedRules.filter((match) => match.ruleId === rule.id),
    ),
  );
  const result = createDecision(policy, matchedRules);
  return {
    chunks:
      result.decision === "deny"
        ? []
        : evaluatedChunks.map((evaluatedChunk) => evaluatedChunk.chunk),
    decision: result,
  };
}
