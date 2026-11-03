import {
  parsePolicyDocument,
  type PolicyDocument,
} from "@cortex/shared/policy";

export function parsePolicyDraft(draft: string): {
  document?: PolicyDocument;
  error?: string;
} {
  let input: unknown;
  try {
    input = JSON.parse(draft);
  } catch {
    return { error: "Invalid JSON. Check commas, quotes, and brackets." };
  }
  try {
    return { document: parsePolicyDocument(input) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid policy rules.",
    };
  }
}
