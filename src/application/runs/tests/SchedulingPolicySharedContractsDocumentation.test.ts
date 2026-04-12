import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-policy-shared-contracts.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-policy-shared-contracts.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling policy shared contract documentation", () => {
  it("keeps scheduling shared-contract docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents canonical shared scheduling contract and schema modules", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts");
    expect(doc).toContain("src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts");
    expect(doc).toContain("SchedulingPolicyEvaluationResult");
    expect(doc).toContain("SchedulingCandidateReasoningSummary");
    expect(doc).toContain("SchedulingQueueEvaluationSummary");
  });

  it("keeps architecture and contributor docs discoverable for shared scheduling contracts", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-policy-shared-contracts.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-policy-shared-contracts.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-policy-shared-contracts.md");
    expect(contributorDoc).toContain("SchedulingPolicyEvaluationContracts.ts");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-policy-shared-contracts.md");
    expect(contributorAiDoc).toContain("SchedulingPolicyEvaluationSchemaContracts");
  });

  it("keeps AI companion scheduling shared-contract doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-policy-shared-contracts.md");
    expect(aiDoc).toContain("src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts");
    expect(aiDoc).toContain("src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts");
  });
});
