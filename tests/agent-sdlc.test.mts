import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

/** Upstream phase and dependency skills required by issue #38. */
const requiredUpstreamSkills = [
  "code-review",
  "domain-modeling",
  "grill-with-docs",
  "grilling",
  "implement",
  "pr",
  "retro",
  "tdd",
  "to-spec",
  "to-tickets",
  "writing-for-agents",
] as const;

const lifecycleCommands = [
  "/grill-with-docs",
  "/to-spec",
  "/to-tickets",
  "/implement",
  "/tdd",
  "/code-review",
  "/pr",
  "/retro",
] as const;

const lifecyclePhases = [
  "### Planning",
  "### Analysis",
  "### Design",
  "### Coding",
  "### Testing",
  "### Deployment",
  "### Maintenance",
] as const;

const readRepoFile = (path: string) =>
  readFile(new URL(path, repoRoot), { encoding: "utf8" });

test("required SDLC skills are installed and locked", async () => {
  const lock = JSON.parse(await readRepoFile("skills-lock.json")) as {
    skills: Record<string, { source?: string }>;
  };

  await Promise.all(
    requiredUpstreamSkills.map(async (skillName) => {
      const manifest = await readRepoFile(
        `.agents/skills/${skillName}/SKILL.md`,
      );

      assert.match(manifest, new RegExp(`^name: ${skillName}$`, "m"));
      assert.equal(lock.skills[skillName]?.source, "mattpocock/skills");
    }),
  );
});

test("issue-sdlc orchestrates autonomous issue delivery", async () => {
  const [orchestrator, agentGuidance] = await Promise.all([
    readRepoFile(".agents/skills/issue-sdlc/SKILL.md"),
    readRepoFile("AGENTS.md"),
  ]);

  assert.match(orchestrator, /^name: issue-sdlc$/m);
  assert.match(orchestrator, /docs\/agents\/sdlc\.md/);
  assert.match(orchestrator, /do not create a duplicate issue/i);
  assert.match(agentGuidance, /issue-sdlc/);
});

test("agent guidance exposes the complete issue delivery lifecycle", async () => {
  const [agentGuidance, lifecycle, issueTracker, domain, glossary, triage] =
    await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("docs/agents/sdlc.md"),
      readRepoFile("docs/agents/issue-tracker.md"),
      readRepoFile("docs/agents/domain.md"),
      readRepoFile("GLOSSARY.md"),
      readRepoFile("docs/agents/triage-labels.md"),
    ]);

  assert.match(agentGuidance, /docs\/agents\/sdlc\.md/);
  assert.match(agentGuidance, /docs\/agents\/issue-tracker\.md/);
  assert.match(agentGuidance, /docs\/agents\/domain\.md/);
  assert.match(issueTracker, /GitHub Issues/);
  assert.match(issueTracker, /triage-labels\.md/);
  assert.match(domain, /GLOSSARY\.md/);
  assert.match(glossary, /^# Ubiquitous Language$/m);
  assert.match(triage, /ready-for-agent/);

  for (const command of lifecycleCommands) {
    assert.ok(lifecycle.includes(command), `${command} is missing from SDLC`);
  }

  const phaseSkillOrder = [
    { phase: "### Planning", skill: "/grill-with-docs" },
    { phase: "### Analysis", skill: "/to-spec" },
    { phase: "### Design", skill: "/to-tickets" },
  ] as const;

  for (const { phase, skill } of phaseSkillOrder) {
    const phaseIndex = lifecycle.indexOf(phase);
    const skillIndex = lifecycle.indexOf(skill, phaseIndex);
    const nextPhaseIndex = lifecycle.indexOf("###", phaseIndex + 1);
    assert.ok(phaseIndex >= 0, `${phase} is missing`);
    assert.ok(
      skillIndex > phaseIndex &&
        (nextPhaseIndex < 0 || skillIndex < nextPhaseIndex),
      `${skill} must appear under ${phase}`,
    );
  }

  let previousPhaseIndex = -1;
  for (const phase of lifecyclePhases) {
    const phaseIndex = lifecycle.indexOf(phase);
    assert.ok(
      phaseIndex > previousPhaseIndex,
      `${phase} is missing or unordered`,
    );
    previousPhaseIndex = phaseIndex;
  }

  assert.match(lifecycle, /do not create a duplicate issue/i);
});
