export type PolicyCondition =
  | { queryContains: string }
  | { chunkContentContains: string };

export type PolicyRule =
  | {
      id: string;
      when: PolicyCondition;
      effect: "deny";
      reasonCode: string;
      reason: string;
    }
  | {
      id: string;
      when: { chunkContentContains: string };
      effect: "redact";
      replacement: string;
    };

export interface PolicyDocument {
  schemaVersion: 1;
  allowedSourceIds: string[];
  rules: PolicyRule[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function keys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      throw new Error(`${path}.${key} is unsupported`);
  }
}

function text(value: unknown, path: string, max = 1000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(
      `${path} must be a non-empty string of at most ${max} characters`,
    );
  }
  return value;
}

/** Strict, shared boundary validation; never accepts executable rule expressions. */
export function parsePolicyDocument(input: unknown): PolicyDocument {
  const doc = object(input, "policy");
  keys(doc, ["schemaVersion", "allowedSourceIds", "rules"], "policy");
  if (doc.schemaVersion !== 1)
    throw new Error("policy.schemaVersion must be 1");
  if (
    !Array.isArray(doc.allowedSourceIds) ||
    doc.allowedSourceIds.length > 1000
  ) {
    throw new Error(
      "policy.allowedSourceIds must be an array of at most 1000 source IDs",
    );
  }
  const allowedSourceIds = doc.allowedSourceIds.map((id, i) =>
    text(id, `policy.allowedSourceIds[${i}]`, 200),
  );
  if (new Set(allowedSourceIds).size !== allowedSourceIds.length) {
    throw new Error("policy.allowedSourceIds must be unique");
  }
  if (!Array.isArray(doc.rules) || doc.rules.length > 100) {
    throw new Error("policy.rules must be an array of at most 100 rules");
  }
  const ids = new Set<string>();
  const rules = doc.rules.map((inputRule, i): PolicyRule => {
    const path = `policy.rules[${i}]`;
    const rule = object(inputRule, path);
    const id = text(rule.id, `${path}.id`, 100);
    if (ids.has(id)) throw new Error(`${path}.id must be unique`);
    ids.add(id);
    const when = object(rule.when, `${path}.when`);
    keys(when, ["queryContains", "chunkContentContains"], `${path}.when`);
    if (Object.keys(when).length !== 1) {
      throw new Error(`${path}.when must have exactly one condition`);
    }
    const condition: PolicyCondition =
      "queryContains" in when
        ? {
            queryContains: text(
              when.queryContains,
              `${path}.when.queryContains`,
            ),
          }
        : {
            chunkContentContains: text(
              when.chunkContentContains,
              `${path}.when.chunkContentContains`,
            ),
          };
    if (rule.effect === "deny") {
      keys(rule, ["id", "when", "effect", "reasonCode", "reason"], path);
      const reasonCode = text(rule.reasonCode, `${path}.reasonCode`, 100);
      if (!/^[A-Z][A-Z0-9_]*$/.test(reasonCode)) {
        throw new Error(`${path}.reasonCode must be an uppercase machine code`);
      }
      return {
        id,
        when: condition,
        effect: "deny",
        reasonCode,
        reason: text(rule.reason, `${path}.reason`),
      };
    }
    if (rule.effect === "redact") {
      keys(rule, ["id", "when", "effect", "replacement"], path);
      if (!("chunkContentContains" in condition)) {
        throw new Error(`${path}.redact requires chunkContentContains`);
      }
      if (
        typeof rule.replacement !== "string" ||
        rule.replacement.length > 1000
      ) {
        throw new Error(
          `${path}.replacement must be a string of at most 1000 characters`,
        );
      }
      return {
        id,
        when: condition,
        effect: "redact",
        replacement: rule.replacement,
      };
    }
    throw new Error(`${path}.effect must be deny or redact`);
  });
  return { schemaVersion: 1, allowedSourceIds, rules };
}
