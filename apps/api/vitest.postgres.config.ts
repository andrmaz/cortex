import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: {
    alias: [
      {
        find: /^@cortex\/shared\/policy$/,
        replacement: src("../../packages/shared/src/policy.ts"),
      },
      {
        find: /^db\/client$/,
        replacement: src("../../packages/db/generated/prisma/client.ts"),
      },
      { find: /^db$/, replacement: src("../../packages/db/src/index.ts") },
    ],
  },
  test: {
    include: ["src/**/*.postgres.spec.ts"],
    environment: "node",
  },
});
