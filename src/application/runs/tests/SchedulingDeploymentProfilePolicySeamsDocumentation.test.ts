import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-deployment-profile-policy-seams.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-deployment-profile-policy-seams.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling deployment-profile policy seams documentation", () => {
  it("keeps deployment-profile seam docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents deployment-profile policy context and rule-set provider seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("ISchedulingDeploymentProfilePolicyContextPort");
    expect(doc).toContain("ISchedulingPolicyRuleSetProvider");
    expect(doc).toContain("AssembleAuthoritativeSchedulingInputUseCase.ts");
    expect(doc).toContain("EvaluateAuthoritativeSchedulingPolicyUseCase.ts");
    expect(doc).toContain("No mock deployment-profile toggles");
    expect(doc).toContain("classroom");
    expect(doc).toContain("organization");
  });

  it("keeps architecture and contributor docs discoverable for deployment-profile seam guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-deployment-profile-policy-seams.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-deployment-profile-policy-seams.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-deployment-profile-policy-seams.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-deployment-profile-policy-seams.md");
  });

  it("keeps AI companion deployment-profile seam doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-deployment-profile-policy-seams.md");
    expect(aiDoc).toContain("SchedulingPolicyProfilePorts.ts");
    expect(aiDoc).toContain("avoid shipping placeholder profile toggles");
  });
});
