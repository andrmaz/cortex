import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { configDefaults, defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // esbuild does not emit decorator metadata, which Nest DI relies on.
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: {
    alias: [
      {
        find: /^@cortex\/shared$/,
        replacement: src("../../packages/shared/src/index.ts"),
      },
      {
        find: /^db\/client$/,
        replacement: src("./src/__mocks__/db-client.mock.ts"),
      },
      { find: /^db$/, replacement: src("./src/__mocks__/db-client.mock.ts") },
    ],
  },
  test: {
    include: ["src/**/*.spec.ts"],
    exclude: [...configDefaults.exclude, "**/*.postgres.spec.ts"],
    environment: "node",
    coverage: { reportsDirectory: "coverage" },
  },
});
