import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-policy-framework-and-rule-pipeline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-policy-framework-and-rule-pipeline.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling policy framework documentation", () => {
  it("keeps scheduling policy framework docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents modular rule-pipeline architecture and authoritative policy evaluator use cases", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("SchedulingPolicyRulePorts.ts");
    expect(doc).toContain("SchedulingPolicyRulePipeline.ts");
    expect(doc).toContain("EvaluateAuthoritativeSchedulingPolicyUseCase.ts");
    expect(doc).toContain("EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts");
    expect(doc).toContain("ordered");
    expect(doc).toContain("modular");
    expect(doc).toContain("explainable");
  });

  it("keeps architecture and contributor docs discoverable for the scheduling framework story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-policy-framework-and-rule-pipeline.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-policy-framework-and-rule-pipeline.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-policy-framework-and-rule-pipeline.md");
    expect(contributorDoc).toContain("SchedulingPolicyRulePorts.ts");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-policy-framework-and-rule-pipeline.md");
    expect(contributorAiDoc).toContain("SchedulingPolicyRulePipeline.ts");
  });

  it("keeps AI companion framework doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.md");
    expect(aiDoc).toContain("SchedulingPolicyRulePorts.ts");
    expect(aiDoc).toContain("EvaluateAuthoritativeSchedulingPolicyUseCase.ts");
  });
});
