import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("development builds the shared policy runtime before starting its consumers", () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../node_modules/turbo/bin/turbo", import.meta.url),
        ),
        "run",
        "dev",
        "--filter=@cortex/web",
        "--filter=@cortex/api",
        "--dry=json",
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf8",
      },
    ),
  );
  for (const consumer of ["@cortex/web#dev", "@cortex/api#dev"]) {
    const task = plan.tasks.find((task) => task.taskId === consumer);
    assert.ok(task, `${consumer} must be scheduled`);
    assert.ok(
      task.dependencies.includes("@cortex/shared#build"),
      `${consumer} must wait for the compiled policy export`,
    );
  }
});
