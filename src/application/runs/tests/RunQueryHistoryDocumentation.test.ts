import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-query-and-history-discovery.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-query-and-history-discovery.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("run query and history discovery documentation", () => {
  it("keeps query/history discovery docs checked in for human and AI companion guidance", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents authoritative history listing filters, authorization posture, and DTO history hints", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("authoritative persisted metadata");
    expect(doc).toContain("owner/system/status/time");
    expect(doc).toContain("recent activity");
    expect(doc).toContain("run.read");
    expect(doc).toContain("history hints");
    expect(doc).toContain("normalized status");
    expect(doc).toContain("progress snapshot");
    expect(doc).toContain("failure/result availability");
  });

  it("keeps architecture index discoverability updated for query/history discovery docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    expect(readme).toContain("run-orchestration-query-and-history-discovery.md");
    expect(readmeAi).toContain("run-orchestration-query-and-history-discovery.md");
  });
});
