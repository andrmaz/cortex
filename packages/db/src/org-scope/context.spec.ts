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
   * `Promise`, which begins settling as soon as it's constructed. This
   * mirrors the behavior `runWithOrgContext` must consume before restoring
   * the previous context.
   */
  function createLazyThenable<T>(resolve: () => T): PromiseLike<T> {
    return {
      then<TResult1 = T, TResult2 = never>(
        onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null,
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve().then(resolve).then(onFulfilled, onRejected);
      },
    };
  }

  it("preserves the bound context while consuming a returned lazy thenable", async () => {
    const observed: unknown[] = [];
    const result = await runWithOrgContext("org-1", () =>
      createLazyThenable(() => {
        observed.push(getOrgContext());
        return "resolved";
      }),
    );

    expect(result).toBe("resolved");
    expect(observed).toEqual([{ organizationId: "org-1" }]);
    expect(getOrgContext()).toBeUndefined();
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
