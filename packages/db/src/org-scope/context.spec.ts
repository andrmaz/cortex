import {
  getOrgContext,
  isUnscopedContext,
  runWithOrgContext,
  runWithoutOrgScope,
} from "./context.js";

describe("org context", () => {
  it("returns undefined when no context is active", () => {
    expect(getOrgContext()).toBeUndefined();
  });

  it("exposes the bound organizationId within runWithOrgContext", () => {
    runWithOrgContext("org-1", () => {
      expect(getOrgContext()).toEqual({ organizationId: "org-1" });
    });
  });

  it("clears the context once runWithOrgContext returns", () => {
    runWithOrgContext("org-1", () => undefined);
    expect(getOrgContext()).toBeUndefined();
  });

  it("propagates context across async continuations (await boundaries)", async () => {
    await runWithOrgContext("org-async", async () => {
      await Promise.resolve();
      expect(getOrgContext()).toEqual({ organizationId: "org-async" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getOrgContext()).toEqual({ organizationId: "org-async" });
    });
  });

  it("isolates concurrent contexts from each other", async () => {
    const seenInA: unknown[] = [];
    const seenInB: unknown[] = [];

    await Promise.all([
      runWithOrgContext("org-a", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        seenInA.push(getOrgContext());
      }),
      runWithOrgContext("org-b", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        seenInB.push(getOrgContext());
      }),
    ]);

    expect(seenInA).toEqual([{ organizationId: "org-a" }]);
    expect(seenInB).toEqual([{ organizationId: "org-b" }]);
  });

  it("marks the unscoped escape hatch distinctly from a normal org context", () => {
    runWithoutOrgScope(() => {
      const context = getOrgContext();
      expect(context).toBeDefined();
      expect(isUnscopedContext(context!)).toBe(true);
    });

    runWithOrgContext("org-1", () => {
      const context = getOrgContext();
      expect(isUnscopedContext(context!)).toBe(false);
    });
  });

  /**
   * A "lazy thenable" that, like Prisma's client methods, does nothing
   * until something actually calls `.then()` on it — unlike a plain
   * `Promise`, which begins settling as soon as it's constructed. This is
   * what makes `runWithOrgContext`'s callback shape matter: a callback that
   * just *returns* a lazy thenable (instead of `async`ly consuming it)
   * hands back an inert value with no `.then()` reaction registered yet,
   * so nothing ties the eventual reaction to the active context.
   */
  function createLazyThenable<T>(resolve: () => T) {
    return {
      then(onFulfilled: (value: T) => void) {
        queueMicrotask(() => onFulfilled(resolve()));
      },
    };
  }

  it("loses the bound context when the callback merely returns a lazy thenable instead of awaiting it", async () => {
    const observed: unknown[] = [];
    const rawThenable = runWithOrgContext("org-1", () =>
      createLazyThenable(() => observed.push(getOrgContext())),
    );

    await new Promise<void>((resolve) => {
      // Mirrors an outer, uninstrumented caller awaiting the callback's
      // return value — by now `runWithOrgContext` has already exited and
      // restored the previous (absent) context.
      (rawThenable as { then(cb: () => void): void }).then(resolve);
    });

    expect(observed).toEqual([undefined]);
  });

  it("preserves the bound context when the callback is async and awaits the lazy thenable itself", async () => {
    const observed: unknown[] = [];
    await runWithOrgContext("org-1", async () => {
      const thenable = createLazyThenable(() => observed.push(getOrgContext()));
      await thenable;
    });

    expect(observed).toEqual([{ organizationId: "org-1" }]);
  });

  it("nesting runWithOrgContext inside runWithoutOrgScope re-applies scoping for the inner block", () => {
    runWithoutOrgScope(() => {
      expect(isUnscopedContext(getOrgContext()!)).toBe(true);
      runWithOrgContext("org-nested", () => {
        expect(getOrgContext()).toEqual({ organizationId: "org-nested" });
      });
      expect(isUnscopedContext(getOrgContext()!)).toBe(true);
    });
  });
});
