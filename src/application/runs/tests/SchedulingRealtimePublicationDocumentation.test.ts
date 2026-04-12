import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-realtime-event-publication.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-realtime-event-publication.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling realtime publication documentation", () => {
  it("keeps scheduling realtime publication docs checked in for human and AI companion guidance", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents canonical scheduling realtime event kinds and authoritative publication boundaries", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("scheduling-priority-placement-selected");
    expect(doc).toContain("scheduling-deferred-no-placement");
    expect(doc).toContain("scheduling-reservation-conflict");
    expect(doc).toContain("scheduling-requeued");
    expect(doc).toContain("runtime.run.status");
    expect(doc).toContain("runtime.queue");
    expect(doc).toContain("best-effort");
  });

  it("keeps architecture and contributor indexes discoverable for this scheduling realtime story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-realtime-event-publication.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-realtime-event-publication.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-realtime-event-publication.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-realtime-event-publication.md");
  });

  it("keeps AI companion guidance aligned with canonical implementation files", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");
    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-realtime-event-publication.md");
    expect(aiDoc).toContain("PlatformSchedulingGovernanceEventSink.ts");
    expect(aiDoc).toContain("AuthoritativeRunMutationBackendApi.ts");
  });
});