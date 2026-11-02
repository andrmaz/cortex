import type { PolicyJsonParseResult, PolicyRulesJson } from "./types";

export function parsePolicyRulesJson(raw: string): PolicyJsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: "Enter valid JSON." };
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("rules" in value) ||
    !Array.isArray(value.rules) ||
    !value.rules.every((rule: unknown) => typeof rule === "string")
  ) {
    return {
      error: 'Policy JSON must contain only a "rules" array of strings.',
    };
  }

  return { value: value as PolicyRulesJson };
}
