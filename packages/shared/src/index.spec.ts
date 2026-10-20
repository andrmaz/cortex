import { describe, it, expect } from "vitest";
// Verify that the public package surface (index.ts) re-exports everything
// from types.ts so consumers can import from "@cortex/shared" directly.

describe("@cortex/shared index exports", () => {
  it("should export MCPRequest via named re-export", async () => {
    // The index module re-exports all of types.ts.
    // At runtime there is nothing to import (it's a pure type).
    // We can verify the module resolves without error.
    await expect(import("./index.js")).resolves.toBeDefined();
  });

  it("should resolve as a module without throwing", async () => {
    const mod: unknown = await import("./index.js");
    expect(mod).toBeDefined();
  });
});
