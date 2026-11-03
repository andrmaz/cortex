import { describe, expect, it } from "vitest";
import { parsePolicyDocument } from "./policy";

describe("Policy document validation", () => {
  const valid = {
    schemaVersion: 1,
    allowedSourceIds: ["s1"],
    rules: [
      {
        id: "deny",
        when: { queryContains: "private" },
        effect: "deny",
        reasonCode: "PRIVATE_DENIED",
        reason: "Private access denied.",
      },
    ],
  };
  it.each([
    null,
    [],
    {},
    { ...valid, schemaVersion: 2 },
    { ...valid, allowedSourceIds: ["s1", "s1"] },
    { ...valid, rules: [valid.rules[0], valid.rules[0]] },
    { ...valid, rules: [{ ...valid.rules[0], when: {} }] },
    {
      ...valid,
      rules: [
        {
          ...valid.rules[0],
          when: { queryContains: "", chunkContentContains: "x" },
        },
      ],
    },
    { ...valid, rules: [{ ...valid.rules[0], when: { regex: ".*" } }] },
    { ...valid, rules: [{ ...valid.rules[0], reasonCode: "bad code" }] },
    { ...valid, rules: [{ ...valid.rules[0], reason: "" }] },
    { ...valid, rules: [{ ...valid.rules[0], replacement: "x" }] },
    {
      ...valid,
      rules: [
        {
          id: "x",
          effect: "redact",
          when: { queryContains: "x" },
          replacement: "",
        },
      ],
    },
    {
      ...valid,
      rules: [{ id: "x", effect: "allow", when: { queryContains: "x" } }],
    },
    {
      ...valid,
      rules: [
        { id: "x", effect: "redact", when: { chunkContentContains: "x" } },
      ],
    },
  ])("rejects malformed rules at the boundary: %j", (input) => {
    expect(() => parsePolicyDocument(input)).toThrow();
  });
  it("accepts denial reasons and deletion redactions", () => {
    expect(parsePolicyDocument(valid)).toEqual(valid);
    expect(
      parsePolicyDocument({
        schemaVersion: 1,
        allowedSourceIds: [],
        rules: [
          {
            id: "erase",
            effect: "redact",
            when: { chunkContentContains: "secret" },
            replacement: "",
          },
        ],
      }).rules[0]?.effect,
    ).toBe("redact");
  });
  it("accepts the versioned literal-rule contract and rejects unknown keys", () => {
    const document = { schemaVersion: 1, allowedSourceIds: [], rules: [] };
    expect(parsePolicyDocument(document)).toEqual(document);
    expect(() =>
      parsePolicyDocument({ ...document, unrestricted: true }),
    ).toThrow("unrestricted");
  });
});
