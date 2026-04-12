import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-node-run-to-node-eligibility-evaluation.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "execution-node-run-to-node-eligibility-evaluation.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("execution node run-to-node eligibility documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents story scope, rules, and structured outputs", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 5.3.1");
    expect(doc).toContain("eligible");
    expect(doc).toContain("incompatible");
    expect(doc).toContain("unavailable");
    expect(doc).toContain("blockingReasonCodes");
    expect(doc).toContain("advisoryReasonCodes");
  });

  it("keeps architecture indexes discoverable for eligibility docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("execution-node-run-to-node-eligibility-evaluation.md");
    expect(readmeAi).toContain("execution-node-run-to-node-eligibility-evaluation.md");
  });

  it("keeps AI companion doc aligned to canonical implementation seams", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("ImageRunNodeEligibilityEvaluationService.ts");
    expect(aiDoc).toContain("ExecutionNodeManagementPorts.ts");
    expect(aiDoc).toContain("docs/architecture/execution-node-run-to-node-eligibility-evaluation.md");
  });
});
