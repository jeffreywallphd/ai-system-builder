import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling unschedulable defer/backoff documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents no-placement outcomes, defer/backoff handling, and queue-processing boundaries", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("Story 17.2.4");
    expect(doc).toContain("no-placement");
    expect(doc).toContain("defer");
    expect(doc).toContain("MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts");
    expect(doc).toContain("SqlitePlatformPersistenceAdapter.ts");
    expect(doc).toContain("Do not route around authoritative queue claim/defer/release semantics.");
  });

  it("keeps architecture index and contributor docs discoverable for this story", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(readme).toContain("run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md");
    expect(readmeAi).toContain("run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md");
  });

  it("keeps AI companion doc aligned to the canonical human guidance", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");

    expect(aiDoc).toContain(
      "docs/architecture/run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md",
    );
    expect(aiDoc).toContain("EvaluateAuthoritativeSchedulingPolicyUseCase.ts");
    expect(aiDoc).toContain("MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts");
  });
});
