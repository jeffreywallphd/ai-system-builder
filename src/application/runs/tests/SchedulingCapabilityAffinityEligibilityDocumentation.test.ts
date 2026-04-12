import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-required-capability-affinity-eligibility.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-required-capability-affinity-eligibility.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling capability and affinity eligibility documentation", () => {
  it("keeps scheduling capability/affinity docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents required-capability eligibility and basic affinity preference behavior", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("required-capability");
    expect(doc).toContain("placementAffinity");
    expect(doc).toContain("preferredNodeIds");
    expect(doc).toContain("placement-affinity-preference-applied");
    expect(doc).toContain("placement-affinity-preference-unmet");
    expect(doc).toContain("SchedulingPlacementAffinityPreference.ts");
  });

  it("keeps architecture and contributor docs discoverable for this scheduling story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-required-capability-affinity-eligibility.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-required-capability-affinity-eligibility.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-required-capability-affinity-eligibility.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-required-capability-affinity-eligibility.md");
  });

  it("keeps AI companion capability/affinity doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-required-capability-affinity-eligibility.md");
    expect(aiDoc).toContain("SchedulingPlacementAffinityPreference.ts");
    expect(aiDoc).toContain("placement-affinity-preference-applied");
  });
});
