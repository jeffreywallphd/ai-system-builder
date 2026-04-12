import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-decision-reason-capture.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-decision-reason-capture.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling decision reason-capture documentation", () => {
  it("keeps decision reason-capture docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents reason summary and outcome recorder seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("SchedulingDecisionReasonSummary");
    expect(doc).toContain("ISchedulingDecisionOutcomeRecorder");
    expect(doc).toContain("SchedulingDecisionOutcomeCaptureRecord");
    expect(doc).toContain("reasonSummary");
    expect(doc).toContain("run-orchestration-scheduling-decision-reason-capture");
  });

  it("keeps architecture and contributor docs discoverable for this scheduling story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-decision-reason-capture.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-decision-reason-capture.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-decision-reason-capture.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-decision-reason-capture.md");
  });

  it("keeps AI companion reason-capture doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-decision-reason-capture.md");
    expect(aiDoc).toContain("SchedulingDecisionOutcomeCapture.ts");
    expect(aiDoc).toContain("SchedulingPolicyEvaluationContracts.ts");
  });
});
