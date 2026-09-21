import { GoogleStrategy } from "./google.strategy";

const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

describe("GoogleStrategy", () => {
  const previous: Partial<
    Record<(typeof ENV_KEYS)[number], string | undefined>
  > = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      previous[key] = process.env[key];
      process.env[key] = "test-value";
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("throws when GOOGLE_CLIENT_ID is missing", () => {
    delete process.env["GOOGLE_CLIENT_ID"];
    expect(() => new GoogleStrategy()).toThrow(
      "GOOGLE_CLIENT_ID environment variable is required",
    );
  });

  it("throws when GOOGLE_CLIENT_SECRET is missing", () => {
    delete process.env["GOOGLE_CLIENT_SECRET"];
    expect(() => new GoogleStrategy()).toThrow(
      "GOOGLE_CLIENT_SECRET environment variable is required",
    );
  });
});
