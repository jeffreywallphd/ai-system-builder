import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-realtime-event-publication.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-realtime-event-publication.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("run realtime event publication documentation", () => {
  it("keeps realtime event publication docs checked in for human and AI companion guidance", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents canonical orchestration event categories, payload boundaries, and authoritative publication posture", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("runtime.run.status");
    expect(doc).toContain("runtime.queue");
    expect(doc).toContain("event kinds");
    expect(doc).toContain("redaction boundaries");
    expect(doc).toContain("Only authoritative control-plane state transitions publish orchestration realtime events.");
  });

  it("keeps architecture index discoverability updated for realtime event publication docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    expect(readme).toContain("run-orchestration-realtime-event-publication.md");
    expect(readmeAi).toContain("run-orchestration-realtime-event-publication.md");
  });
});
