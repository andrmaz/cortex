import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

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
];

const lifecycleCommands = [
  "/grill-with-docs",
  "/to-spec",
  "/to-tickets",
  "/implement",
  "/tdd",
  "/code-review",
  "/pr",
  "/retro",
];

const lifecyclePhases = [
  "### Planning",
  "### Analysis",
  "### Design",
  "### Coding",
  "### Testing",
  "### Deployment",
  "### Maintenance",
];

const phaseSkillOrder = [
  { phase: "### Planning", skill: "/grill-with-docs" },
  { phase: "### Analysis", skill: "/to-spec" },
  { phase: "### Design", skill: "/to-tickets" },
];

const readRepoFile = (path) =>
  readFile(new URL(path, repoRoot), { encoding: "utf8" });

const assertSkillLocked = async (skillName, lock) => {
  const manifest = await readRepoFile(`.agents/skills/${skillName}/SKILL.md`);
  assert.match(manifest, new RegExp(`^name: ${skillName}$`, "m"));
  assert.equal(lock.skills[skillName]?.source, "mattpocock/skills");
};

const assertPhaseOwnsSkill = (lifecycle, phase, skill) => {
  const phaseIndex = lifecycle.indexOf(phase);
  const skillIndex = lifecycle.indexOf(skill, phaseIndex);
  const nextPhaseIndex = lifecycle.indexOf("###", phaseIndex + 1);
  assert.ok(phaseIndex >= 0, `${phase} is missing`);
  assert.ok(
    skillIndex > phaseIndex &&
      (nextPhaseIndex < 0 || skillIndex < nextPhaseIndex),
    `${skill} must appear under ${phase}`,
  );
};

const assertPhasesOrdered = (lifecycle) => {
  let previousPhaseIndex = -1;
  for (const phase of lifecyclePhases) {
    const phaseIndex = lifecycle.indexOf(phase);
    assert.ok(
      phaseIndex > previousPhaseIndex,
      `${phase} is missing or unordered`,
    );
    previousPhaseIndex = phaseIndex;
  }
};

test("required SDLC skills are installed and locked", async () => {
  const lock = JSON.parse(await readRepoFile("skills-lock.json"));
  await Promise.all(
    requiredUpstreamSkills.map((skillName) => assertSkillLocked(skillName, lock)),
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

test("AGENTS.md links lifecycle and tracker docs", async () => {
  const agentGuidance = await readRepoFile("AGENTS.md");
  assert.match(agentGuidance, /docs\/agents\/sdlc\.md/);
  assert.match(agentGuidance, /docs\/agents\/issue-tracker\.md/);
  assert.match(agentGuidance, /docs\/agents\/domain\.md/);
});

test("issue tracker stays on GitHub Issues with in-place rewrites", async () => {
  const issueTracker = await readRepoFile("docs/agents/issue-tracker.md");
  assert.match(issueTracker, /GitHub Issues/);
  assert.match(issueTracker, /triage-labels\.md/);
  assert.match(issueTracker, /rewrite that same issue body/i);
  assert.doesNotMatch(issueTracker, /--parent|--blocked-by/);
});

test("domain docs point at the glossary and triage vocabulary", async () => {
  const [domain, glossary, triage] = await Promise.all([
    readRepoFile("docs/agents/domain.md"),
    readRepoFile("GLOSSARY.md"),
    readRepoFile("docs/agents/triage-labels.md"),
  ]);
  assert.match(domain, /GLOSSARY\.md/);
  assert.match(glossary, /^# Ubiquitous Language$/m);
  assert.match(triage, /ready-for-agent/);
});

test("sdlc.md lists every lifecycle command", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  for (const command of lifecycleCommands) {
    assert.ok(lifecycle.includes(command), `${command} is missing from SDLC`);
  }
});

test("sdlc.md maps planning analysis and design to the remapped skills", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  for (const { phase, skill } of phaseSkillOrder) {
    assertPhaseOwnsSkill(lifecycle, phase, skill);
  }
});

test("sdlc.md keeps IBM phases ordered and rewrites the same issue", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  assertPhasesOrdered(lifecycle);
  assert.match(lifecycle, /do not create a duplicate issue/i);
  assert.match(lifecycle, /Rewrite the \*\*same\*\* GitHub issue body/i);
});
