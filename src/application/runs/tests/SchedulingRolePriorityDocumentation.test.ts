import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-role-priority-first-release.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-role-priority-first-release.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling role-priority documentation", () => {
  it("keeps role-priority scheduling docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents deterministic role-priority arbitration and visibility outputs", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("RolePrioritySchedulingArbitration.ts");
    expect(doc).toContain("role-priority-arbitration");
    expect(doc).toContain("deterministic");
    expect(doc).toContain("tie-break");
  });

  it("keeps architecture and contributor indices discoverable for role-priority scheduling", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-role-priority-first-release.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-role-priority-first-release.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-role-priority-first-release.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-role-priority-first-release.md");
  });

  it("keeps AI companion role-priority doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-role-priority-first-release.md");
    expect(aiDoc).toContain("RolePrioritySchedulingArbitration.ts");
    expect(aiDoc).toContain("role-priority-arbitration");
  });
});
