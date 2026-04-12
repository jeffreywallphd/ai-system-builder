import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-hybrid-node-local-interactive-protection.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-hybrid-node-local-interactive-protection.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling hybrid local protection documentation", () => {
  it("keeps hybrid local-protection docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents hybrid protection policy signals and explainable gating behavior", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("reservedLocalCapacityUnits");
    expect(doc).toContain("activeRemoteAssignmentCount");
    expect(doc).toContain("protectedLocalUserWindow");
    expect(doc).toContain("hybrid-local-interactive-protection");
    expect(doc).toContain("protectionKind");
    expect(doc).toContain("deferred");
  });

  it("keeps architecture and contributor docs discoverable for hybrid protection guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-hybrid-node-local-interactive-protection.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-hybrid-node-local-interactive-protection.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-hybrid-node-local-interactive-protection.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-hybrid-node-local-interactive-protection.md");
  });

  it("keeps AI companion hybrid protection doc aligned to canonical human doc", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-hybrid-node-local-interactive-protection.md");
    expect(aiDoc).toContain("SchedulingPolicyRulePipeline.ts");
    expect(aiDoc).toContain("hybrid-local-interactive-protection");
  });
});

