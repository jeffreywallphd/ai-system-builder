import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-admin-controls.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-admin-controls.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling admin controls documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents supported admin actions, permission checks, and audit posture", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("Re-evaluate deferred runs");
    expect(doc).toContain("View stale queue reservations");
    expect(doc).toContain("Release stale queue reservations");
    expect(doc).toContain("run.manage");
    expect(doc).toContain("run.scheduling.admin.deferred.re-evaluated");
    expect(doc).toContain("run.scheduling.admin.stale-reservation.released");
    expect(doc).toContain("No arbitrary node-assignment override.");
  });

  it("keeps architecture and contributor indexes discoverable for this story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-admin-controls.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-admin-controls.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-admin-controls.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-admin-controls.md");
  });
});

