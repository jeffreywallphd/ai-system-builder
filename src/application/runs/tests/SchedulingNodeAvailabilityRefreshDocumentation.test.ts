import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-node-availability-and-eligibility-refresh.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-node-availability-and-eligibility-refresh.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling node availability refresh documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents refresh-time node availability handling and stale/unavailable denial reason codes", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("Story 17.2.5");
    expect(doc).toContain("AssembleAuthoritativeSchedulingInputUseCase.ts");
    expect(doc).toContain("node-state-stale");
    expect(doc).toContain("node-state-unavailable");
    expect(doc).toContain("node-revoked");
    expect(doc).toContain("Do not route around authoritative queue claim and scheduler policy evaluation seams.");
  });

  it("keeps architecture index and contributor docs discoverable for this story", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(readme).toContain("run-orchestration-scheduling-node-availability-and-eligibility-refresh.md");
    expect(readmeAi).toContain("run-orchestration-scheduling-node-availability-and-eligibility-refresh.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-node-availability-and-eligibility-refresh.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-node-availability-and-eligibility-refresh.md");
  });

  it("keeps AI companion doc aligned to canonical human guidance", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");

    expect(aiDoc).toContain(
      "docs/architecture/run-orchestration-scheduling-node-availability-and-eligibility-refresh.md",
    );
    expect(aiDoc).toContain("AssembleAuthoritativeSchedulingInputUseCase.ts");
    expect(aiDoc).toContain("node-state-stale");
  });
});
