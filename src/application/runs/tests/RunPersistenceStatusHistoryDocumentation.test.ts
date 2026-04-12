import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-image-run-persistence-and-status-history.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-image-run-persistence-and-status-history.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("run persistence status history documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents persistence structure, status-history schema, and migration version impact", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("platform_run_records");
    expect(doc).toContain("platform_run_status_history");
    expect(doc).toContain("safe_failure_code");
    expect(doc).toContain("safe_failure_message");
    expect(doc).toContain("schema version increases from `6` to `7`");
    expect(doc).toContain("UNIQUE (run_id, run_revision)");
    expect(doc).toContain("Lifecycle transition detection");
  });

  it("keeps architecture index discoverability updated for persistence and status-history docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("run-orchestration-image-run-persistence-and-status-history.md");
    expect(readmeAi).toContain("run-orchestration-image-run-persistence-and-status-history.md");
  });
});
