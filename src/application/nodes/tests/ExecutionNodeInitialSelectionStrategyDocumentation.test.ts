import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-node-initial-selection-strategy.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-node-initial-selection-strategy.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("execution node initial selection strategy documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents deterministic selection behavior and extension seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 5.3.2");
    expect(doc).toContain("deterministic");
    expect(doc).toContain("ImageRunExecutionNodeSelectionService.ts");
    expect(doc).toContain("no-eligible-node");
    expect(doc).toContain("no-candidate-nodes");
  });

  it("keeps architecture indexes discoverable for initial selection guidance", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("execution-node-initial-selection-strategy.md");
    expect(readmeAi).toContain("execution-node-initial-selection-strategy.md");
  });

  it("keeps AI companion doc aligned to canonical implementation seams", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("ImageRunExecutionNodeSelectionService.ts");
    expect(aiDoc).toContain("ExecutionNodeManagementPorts.ts");
    expect(aiDoc).toContain("docs/architecture/execution-node-initial-selection-strategy.md");
  });
});
