import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling authoritative queue integration documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents scheduler-authoritative queue selection and claim-safe assignment materialization seams", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("AssembleAuthoritativeSchedulingInputUseCase.ts");
    expect(doc).toContain("ProcessAuthoritativeRunQueueSchedulingUseCase.ts");
    expect(doc).toContain("MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts");
    expect(doc).toContain("SelectAssignmentReadyRunsUseCase.ts");
    expect(doc).toContain("ClaimRunForNodeDispatchPreparationUseCase.ts");
    expect(doc).toContain("Scheduling decides *which* claimed run/node pair should be materialized.");
  });

  it("keeps architecture index and contributor docs discoverable for the queue-integration story", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(readme).toContain("run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md");
    expect(readmeAi).toContain("run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md");
  });

  it("keeps AI companion doc aligned to the canonical human guidance", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");

    expect(aiDoc).toContain(
      "docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md",
    );
    expect(aiDoc).toContain("AssembleAuthoritativeSchedulingInputUseCase.ts");
    expect(aiDoc).toContain("ProcessAuthoritativeRunQueueSchedulingUseCase.ts");
  });
});

