import { fileURLToPath } from "node:url";
import { configDefaults, mergeConfig } from "vitest/config";
import base from "./vitest.base";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default mergeConfig(base, {
  resolve: {
    alias: [
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
