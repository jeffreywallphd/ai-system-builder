import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-operational-visibility-projections.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-operational-visibility-projections.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("run operational visibility documentation", () => {
  it("keeps operational visibility docs checked in for human and AI companion guidance", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents queue position, action eligibility, and user-safe summary boundaries", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("queue position");
    expect(doc).toContain("action eligibility");
    expect(doc).toContain("user-safe failure");
    expect(doc).toContain("internal diagnostics");
  });

  it("keeps architecture index discoverability updated for operational visibility docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    expect(readme).toContain("run-orchestration-operational-visibility-projections.md");
    expect(readmeAi).toContain("run-orchestration-operational-visibility-projections.md");
  });
});
