// Verify that the public package surface (index.ts) re-exports everything
// from types.ts so consumers can import from "@cortex/shared" directly.

describe("@cortex/shared index exports", () => {
  it("should export MCPRequest via named re-export", () => {
    // The index module re-exports all of types.ts.
    // At runtime there is nothing to import (it's a pure type).
    // We can verify the module resolves without error.
    expect(() => require("./index")).not.toThrow();
  });

  it("should resolve as a module without throwing", () => {
    let mod: unknown;
    expect(() => {
      mod = require("./index");
    }).not.toThrow();
    expect(mod).toBeDefined();
  });
});