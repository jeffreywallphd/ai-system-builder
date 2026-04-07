import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-visibility-projections.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-visibility-projections.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling visibility projections documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents effective priority, defer rationale, placement outcomes, and admin-safe boundaries", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("effectivePriority");
    expect(doc).toContain("defer");
    expect(doc).toContain("placement");
    expect(doc).toContain("admin");
    expect(doc).toContain("run.manage");
    expect(doc).toContain("RunSchedulingVisibilityProjection");
  });

  it("keeps architecture and contributor indexes discoverable for this story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-visibility-projections.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-visibility-projections.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-visibility-projections.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-visibility-projections.md");
  });
});
