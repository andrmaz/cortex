import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // esbuild does not emit decorator metadata, which Nest DI relies on.
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: {
    alias: [
      {
        find: /^@cortex\/shared\/policy$/,
        replacement: fileURLToPath(
          new URL("../../packages/shared/src/policy.ts", import.meta.url),
        ),
      },
      {
        find: /^@cortex\/shared$/,
        replacement: fileURLToPath(
          new URL("../../packages/shared/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
});
