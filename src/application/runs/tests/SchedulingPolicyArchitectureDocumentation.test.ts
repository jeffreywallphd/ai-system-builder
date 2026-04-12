import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-policy-domain-model.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-policy-domain-model.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling policy architecture documentation", () => {
  it("keeps human and AI scheduling architecture docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents canonical scheduling concepts and scheduling-vs-dispatch boundaries", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("SchedulingRunPolicyInput");
    expect(doc).toContain("SchedulingNodePolicyInput");
    expect(doc).toContain("Role-priority baseline policy");
    expect(doc).toContain("Hybrid node local-use protection baseline");
    expect(doc).toContain("Decision-pipeline boundary (application layer)");
    expect(doc).toContain("Non-negotiable boundary between scheduling and execution dispatch");
    expect(doc).toContain("Scheduling does **not** write dispatch attempts directly.");
  });

  it("keeps architecture index and contributor docs discoverable for scheduling policy guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-policy-domain-model.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-policy-domain-model.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-policy-domain-model.md");
    expect(contributorDoc).toContain("src/domain/scheduling/SchedulingDomain.ts");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-policy-domain-model.md");
    expect(contributorAiDoc).toContain("src/application/scheduling");
  });

  it("keeps AI companion scheduling doc aligned to canonical boundaries", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-policy-domain-model.md");
    expect(aiDoc).toContain("Scheduling chooses *which run/node claim should be attempted*.");
    expect(aiDoc).toContain("Policy logic must not be implemented in UI, transport handlers, persistence adapters, or dispatch adapters.");
  });
});
