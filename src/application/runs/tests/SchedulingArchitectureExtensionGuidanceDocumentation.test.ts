import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-architecture-extension-guidance.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-architecture-extension-guidance.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling architecture extension guidance documentation", () => {
  it("keeps scheduling architecture baseline docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents implemented scheduling architecture, current production rules, and extension constraints", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## Production architecture flow");
    expect(doc).toContain("## Current production rules (explicit)");
    expect(doc).toContain("## Current production limits (explicit)");
    expect(doc).toContain("## Extension rules for future policy layers");
    expect(doc).toContain("## Non-negotiable invariants");
    expect(doc).toContain("## Prohibited shortcuts");
    expect(doc).toContain("SchedulingPolicyRulePipeline.ts");
    expect(doc).toContain("RolePrioritySchedulingArbitration.ts");
    expect(doc).toContain("SchedulingPlacementAffinityPreference.ts");
    expect(doc).toContain("scheduling-vs-dispatch separation");
    expect(doc).toContain("Embedding scheduling policy rules in UI components");
  });

  it("keeps architecture and contributor docs discoverable for scheduling extension guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-architecture-extension-guidance.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-architecture-extension-guidance.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-architecture-extension-guidance.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-architecture-extension-guidance.md");
  });

  it("keeps AI companion extension guidance aligned to canonical human doc and prohibitions", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-architecture-extension-guidance.md");
    expect(aiDoc).toContain("SchedulingPolicyRulePipeline.ts");
    expect(aiDoc).toContain("Embedding policy in UI or backend adapters is prohibited.");
  });
});
