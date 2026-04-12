import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling reservation placement hold documentation", () => {
  it("keeps human and AI docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents node placement hold architecture seams and lifecycle semantics", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts");
    expect(doc).toContain("RunOrchestrationPersistencePorts.ts");
    expect(doc).toContain("SqlitePlatformPersistenceAdapter.ts");
    expect(doc).toContain("acquireNodePlacementHold");
    expect(doc).toContain("releaseNodePlacementHold");
  });

  it("keeps architecture index and contributor docs discoverable for placement hold semantics", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(readme).toContain("run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md");
    expect(readmeAi).toContain("run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md");
  });
});
