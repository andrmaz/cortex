import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";
import base from "./vitest.base";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default mergeConfig(base, {
  resolve: {
    alias: [
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
