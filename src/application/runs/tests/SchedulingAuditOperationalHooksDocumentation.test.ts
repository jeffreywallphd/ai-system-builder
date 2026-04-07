import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-audit-operational-hooks.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-audit-operational-hooks.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling audit and operational hooks documentation", () => {
  it("keeps scheduling audit/operational docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents scheduling event hooks, redaction posture, and queue-integration emission points", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("SchedulingGovernanceEventTypes");
    expect(doc).toContain("EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts");
    expect(doc).toContain("MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts");
    expect(doc).toContain("sensitive");
    expect(doc).toContain("manual or administrative scheduling overrides");
  });

  it("keeps architecture and contributor docs discoverable for this scheduling story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-audit-operational-hooks.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-audit-operational-hooks.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-audit-operational-hooks.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-audit-operational-hooks.md");
  });

  it("keeps AI companion guidance aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-audit-operational-hooks.md");
    expect(aiDoc).toContain("SchedulingGovernanceEventPorts.ts");
    expect(aiDoc).toContain("PlatformSchedulingGovernanceEventSink.ts");
  });
});
