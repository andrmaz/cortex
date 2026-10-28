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
  "triage",
  "writing-for-agents",
];

const requiredLocalSkills = ["issue-sdlc", "qa"];

const lifecycleCommands = [
  "/grill-with-docs",
  "/to-spec",
  "/to-tickets",
  "/implement",
  "/tdd",
  "/code-review",
  "/qa",
  "/pr",
  "/retro",
  "/triage",
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
  { phase: "### Coding", skill: "/code-review" },
  { phase: "### Testing", skill: "/qa" },
];

const readRepoFile = (path) =>
  readFile(new URL(path, repoRoot), { encoding: "utf8" });

const assertSkillLocked = async (skillName, lock) => {
  const manifest = await readRepoFile(`.agents/skills/${skillName}/SKILL.md`);
  assert.match(manifest, new RegExp(`^name: ${skillName}$`, "m"));
  assert.equal(lock.skills[skillName]?.source, "mattpocock/skills");
};

const assertLocalSkill = async (skillName) => {
  const manifest = await readRepoFile(`.agents/skills/${skillName}/SKILL.md`);
  assert.match(manifest, new RegExp(`^name: ${skillName}$`, "m"));
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
  await Promise.all([
    ...requiredUpstreamSkills.map((skillName) =>
      assertSkillLocked(skillName, lock),
    ),
    ...requiredLocalSkills.map((skillName) => assertLocalSkill(skillName)),
  ]);
});

test("issue-sdlc orchestrates autonomous issue delivery", async () => {
  const [orchestrator, agentGuidance] = await Promise.all([
    readRepoFile(".agents/skills/issue-sdlc/SKILL.md"),
    readRepoFile("AGENTS.md"),
  ]);

  assert.match(orchestrator, /^name: issue-sdlc$/m);
  assert.match(orchestrator, /docs\/agents\/sdlc\.md/);
  assert.match(orchestrator, /do not create a duplicate issue/i);
  assert.match(orchestrator, /ready-for-agent/);
  assert.match(orchestrator, /\/triage/);
  assert.match(orchestrator, /\/qa/);
  assert.match(agentGuidance, /issue-sdlc/);
});

test("AGENTS.md links lifecycle, tracker, and ready-for-agent", async () => {
  const agentGuidance = await readRepoFile("AGENTS.md");
  assert.match(agentGuidance, /docs\/agents\/sdlc\.md/);
  assert.match(agentGuidance, /docs\/agents\/issue-tracker\.md/);
  assert.match(agentGuidance, /docs\/agents\/domain\.md/);
  assert.match(agentGuidance, /ready-for-agent/);
});

test("issue tracker stays on GitHub Issues with in-place rewrites", async () => {
  const issueTracker = await readRepoFile("docs/agents/issue-tracker.md");
  assert.match(issueTracker, /GitHub Issues/);
  assert.match(issueTracker, /triage-labels\.md/);
  assert.match(issueTracker, /--label ready-for-agent/);
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
  assert.match(triage, /\/triage/);
});

test("sdlc.md lists every lifecycle command", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  for (const command of lifecycleCommands) {
    assert.ok(lifecycle.includes(command), `${command} is missing from SDLC`);
  }
});

test("sdlc.md maps phases to the remapped skills", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  for (const { phase, skill } of phaseSkillOrder) {
    assertPhaseOwnsSkill(lifecycle, phase, skill);
  }
});

test("sdlc.md keeps phases ordered and gates ready-for-agent entry", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  assertPhasesOrdered(lifecycle);
  assert.match(lifecycle, /do not create a duplicate issue/i);
  assert.match(lifecycle, /Rewrite the \*\*same\*\* GitHub issue body/i);
  assert.match(lifecycle, /Has `ready-for-agent`/);
  assert.match(lifecycle, /Skip Planning, Analysis, and Design/);
  assert.match(lifecycle, /Chrome DevTools MCP/);
});

test("qa skill defines a Chrome DevTools walkthrough", async () => {
  const qa = await readRepoFile(".agents/skills/qa/SKILL.md");
  assert.match(qa, /^name: qa$/m);
  assert.match(qa, /Chrome DevTools/i);
  assert.match(qa, /acceptance criterion/i);
  assert.match(qa, /## QA walkthrough/);
});

const parseScenarios = (lifecycle) => {
  const section =
    lifecycle.split("### Activation scenarios")[1]?.split("\n## ")[0] ?? "";
  const rows = section
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  return new Map(
    rows.map(([name, decision, evidence, status]) => [
      name,
      { decision, evidence, status },
    ]),
  );
};

const expectedScenarios = [
  ["Planning-only request", /Do not activate/, /plan/i, /planning-only/],
  [
    "Approved plan handed off",
    /Reassess.*Entry.*triage/,
    /readiness result, scope, write authorization/,
    /never counts as readiness/,
  ],
  [
    "Explicitly requested end-to-end",
    /all phases through Maintenance/,
    /every applicable phase/,
    /terminal completion check/,
  ],
  [
    "Issue has `ready-for-agent`",
    /only.*Coding review and QA still run/,
    /Coding review and QA evidence/,
    /never as `passed`/,
  ],
  ["Issue has `needs-info`", /do not implement/, /blocking state/, /`blocked`/],
  [
    "Completion claimed without",
    /Do not complete/,
    /complete change surface.*QA evidence per acceptance criterion/,
    /not delivered/,
  ],
  [
    "Resume with a missing ledger",
    /Re-run Entry/,
    /lost one/,
    /`unverified`.*never claim/,
  ],
  [
    "Pull request requested outside",
    /Do not push, edit the issue, or open a PR/,
    /authorization blocker/,
    /Deployment `blocked`.*not complete/,
  ],
];

test("sdlc.md activation scenarios define decision, evidence, and truthful status", async () => {
  const scenarios = parseScenarios(await readRepoFile("docs/agents/sdlc.md"));
  assert.equal(scenarios.size, expectedScenarios.length);
  for (const [prefix, decision, evidence, status] of expectedScenarios) {
    const key = [...scenarios.keys()].find((name) => name.startsWith(prefix));
    assert.ok(key, `scenario "${prefix}" is missing`);
    const row = scenarios.get(key);
    assert.match(row.decision, decision, `${prefix}: decision`);
    assert.match(row.evidence, evidence, `${prefix}: evidence`);
    assert.match(row.status, status, `${prefix}: status`);
  }
});

test("sdlc.md separates plan approval from external-write authorization", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  assert.match(
    lifecycle,
    /never implies authorization for external GitHub writes/,
  );
  assert.match(lifecycle, /Reassess workflow selection at every handoff/);
  assert.match(
    lifecycle,
    /`enhancement`, `bug`, or `mvp` do not make an issue ready/,
  );
});

test("sdlc.md terminal completion check gates every lifecycle gate", async () => {
  const lifecycle = await readRepoFile("docs/agents/sdlc.md");
  const check =
    lifecycle.split("## Terminal completion check")[1]?.split("\n## ")[0] ?? "";
  for (const gate of [
    "readiness",
    "Coding review",
    "QA",
    "Deployment",
    "Maintenance",
  ]) {
    assert.ok(check.includes(gate), `${gate} missing from completion check`);
  }
  assert.match(check, /completion-tool reminder/);
  assert.match(check, /full lifecycle complete/);
  assert.match(lifecycle, /formatting churn/);
});

test("AGENTS.md and issue-sdlc skill share activation rules", async () => {
  const [agents, skill] = await Promise.all([
    readRepoFile("AGENTS.md"),
    readRepoFile(".agents/skills/issue-sdlc/SKILL.md"),
  ]);
  for (const doc of [agents, skill]) {
    assert.match(doc, /[Pp]lanning-only/);
    assert.match(doc, /plan approval/i);
    assert.match(doc, /external (GitHub )?writes/);
    assert.match(doc, /ledger/);
  }
  assert.match(skill, /terminal completion check/);
  assert.match(agents, /terminal completion check/);
});
