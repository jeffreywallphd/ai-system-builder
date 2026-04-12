import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-readiness-node-availability-checks.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-readiness-node-availability-checks.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("execution readiness node availability documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents story scope and node-aware readiness outcomes", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 5.3.4");
    expect(doc).toContain("nodeAvailability");
    expect(doc).toContain("execution-node-no-eligible-match");
    expect(doc).toContain("execution-node-candidates-unavailable");
  });

  it("keeps architecture indexes discoverable for node-aware readiness guidance", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("execution-readiness-node-availability-checks.md");
    expect(readmeAi).toContain("execution-readiness-node-availability-checks.md");
  });

  it("keeps AI companion doc aligned to canonical implementation seams", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("GetImageManipulationExecutionReadinessUseCase.ts");
    expect(aiDoc).toContain("ImageRunExecutionNodeSelectionService.ts");
    expect(aiDoc).toContain("docs/architecture/execution-readiness-node-availability-checks.md");
  });
});
