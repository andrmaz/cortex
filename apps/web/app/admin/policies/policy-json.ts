import type { PolicyJsonParseResult, PolicyRulesJson } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((rule: unknown) => typeof rule === "string")
  );
}

function isPolicyRulesJson(value: unknown): value is PolicyRulesJson {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.keys(value).length === 1 &&
    "rules" in value &&
    isStringArray(value["rules"])
  );
}

export function parsePolicyRulesJson(raw: string): PolicyJsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: "Enter valid JSON." };
  }

  if (!isPolicyRulesJson(value)) {
    return {
      error: 'Policy JSON must contain only a "rules" array of strings.',
    };
  }

  return { value };
}
