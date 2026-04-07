import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-deterministic-candidate-arbitration.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-deterministic-candidate-arbitration.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling deterministic arbitration documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents centralized deterministic tie-break behavior and explainability details", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("RolePrioritySchedulingArbitration.ts");
    expect(doc).toContain("EvaluateAuthoritativeSchedulingPolicyUseCase.ts");
    expect(doc).toContain("decisiveTieBreakStage");
    expect(doc).toContain("topRankedCandidates");
    expect(doc).toContain("run-orchestration-scheduling-deterministic-candidate-arbitration");
  });

  it("keeps architecture index and contributor docs discoverable for deterministic arbitration guidance", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(readme).toContain("run-orchestration-scheduling-deterministic-candidate-arbitration.md");
    expect(readmeAi).toContain("run-orchestration-scheduling-deterministic-candidate-arbitration.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-deterministic-candidate-arbitration.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-deterministic-candidate-arbitration.md");
  });

  it("keeps AI companion doc aligned with the canonical architecture guidance and implementation seams", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-deterministic-candidate-arbitration.md");
    expect(aiDoc).toContain("RolePrioritySchedulingArbitration.ts");
    expect(aiDoc).toContain("EvaluateAuthoritativeSchedulingPolicyUseCase.ts");
  });
});
