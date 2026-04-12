import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-observability-metrics-and-redaction.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-scheduling-observability-metrics-and-redaction.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");

describe("scheduling observability, metrics, and redaction documentation", () => {
  it("keeps scheduling observability docs checked in for human and AI companion guidance", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents structured diagnostics, scheduler counters, and sensitive-data redaction posture", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("structured");
    expect(doc).toContain("defer/no-placement");
    expect(doc).toContain("reservation conflict");
    expect(doc).toContain("RunOrchestrationObservability.ts");
    expect(doc).toContain("RunOrchestrationObservabilityRedaction.ts");
    expect(doc).toContain("redacted");
  });

  it("keeps architecture and contributor indexes discoverable for this scheduling observability story", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureReadme).toContain("run-orchestration-scheduling-observability-metrics-and-redaction.md");
    expect(architectureReadmeAi).toContain("run-orchestration-scheduling-observability-metrics-and-redaction.md");
    expect(contributorDoc).toContain("run-orchestration-scheduling-observability-metrics-and-redaction.md");
    expect(contributorAiDoc).toContain("run-orchestration-scheduling-observability-metrics-and-redaction.md");
  });

  it("keeps AI companion guidance aligned with canonical implementation files", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");
    expect(aiDoc).toContain("docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.md");
    expect(aiDoc).toContain("PlatformSchedulingGovernanceEventSink.ts");
    expect(aiDoc).toContain("RunOrchestrationObservabilityRedaction.ts");
  });
});
